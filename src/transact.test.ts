import { test, before, after } from "node:test"
import assert from "node:assert"
import { GenericContainer, type StartedTestContainer } from "testcontainers"
import { CreateTableCommand, DeleteTableCommand, type DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { type DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb"
import { BALANCES, TRANSACTIONS } from "./consts.ts"
import { ERROR, transact } from "./transact.ts"
import { createClient, createDocumentClient } from "./create-client.ts"

let container: StartedTestContainer
let client: DynamoDBClient
let docClient: DynamoDBDocumentClient

before(async () => {
  process.env.AWS_ACCESS_KEY_ID = 'test'
  process.env.AWS_SECRET_ACCESS_KEY = 'test'
  process.env.AWS_REGION = 'us-west-2'

  container = await new GenericContainer('amazon/dynamodb-local')
    .withCommand(['-jar', 'DynamoDBLocal.jar', '-sharedDb', '-inMemory'])
    .withExposedPorts(8000)
    .start()
  const endpoint = `http://${container.getHost()}:${container.getMappedPort(8000)}`
  client = createClient(endpoint)
  docClient = createDocumentClient(client)

  await client.send(new CreateTableCommand({
    TableName: BALANCES,
    AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    BillingMode: "PAY_PER_REQUEST"
  }))
  await client.send(new CreateTableCommand({
    TableName: TRANSACTIONS,
    AttributeDefinitions: [{ AttributeName: "idempotentKey", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "idempotentKey", KeyType: "HASH" }],
    BillingMode: "PAY_PER_REQUEST"
  }))
})

after(async () => {
  await container.stop()
  docClient.destroy()
  client.destroy()
})

const getBalance = (userId: string) =>
  docClient.send(new GetCommand({ TableName: BALANCES, Key: { id: userId } }))
    .then(res => res.Item?.balance ?? null)

test("credit: adds balance if not exists", async () => {
  const userId = "u1"
  const idempotentKey = "tx1"
  const result = await transact(docClient)({ idempotentKey, userId, amount: "50", type: "credit" })
  assert.strictEqual(result, true)
  const balance = await getBalance(userId)
  assert.strictEqual(balance, 50)
})

test("credit: adds to existing balance", async () => {
  const userId = "u2"
  await docClient.send(new PutCommand({ TableName: BALANCES, Item: { id: userId, balance: 20 } }))
  const idempotentKey = "tx2"
  const result = await transact(docClient)({ idempotentKey, userId, amount: "30", type: "credit" })
  assert.strictEqual(result, true)
  const balance = await getBalance(userId)
  assert.strictEqual(balance, 50)
})

test("debit: subtracts if sufficient funds", async () => {
  const userId = "u3"
  await docClient.send(new PutCommand({ TableName: BALANCES, Item: { id: userId, balance: 100 } }))
  const idempotentKey = "tx3"
  const result = await transact(docClient)({ idempotentKey, userId, amount: "40", type: "debit" })
  assert.strictEqual(result, true)
  const balance = await getBalance(userId)
  assert.strictEqual(balance, 60)
})

test("debit: fails if insufficient funds", async () => {
  const userId = "u4"
  await docClient.send(new PutCommand({ TableName: BALANCES, Item: { id: userId, balance: 10 } }))
  const idempotentKey = "tx4"
  await assert.rejects(
    () => transact(docClient)({ idempotentKey, userId, amount: "30", type: "debit" }),
    { message: ERROR.debit }
  )
  const balance = await getBalance(userId)
  assert.strictEqual(balance, 10)
})

test("debit: fails if user does not exist", async () => {
  const userId = "u5"
  const idempotentKey = "tx5"
  await assert.rejects(
    () => transact(docClient)({ idempotentKey, userId, amount: "10", type: "debit" }),
    { message: ERROR.debit }
  )
})

test("idempotency: fails on duplicate transaction", async () => {
  const userId = "u6"
  await docClient.send(new PutCommand({ TableName: BALANCES, Item: { id: userId, balance: 100 } }))
  const idempotentKey = "tx6"
  const first = await transact(docClient)({ idempotentKey, userId, amount: "10", type: "debit" })
  assert.strictEqual(first, true)
  await assert.rejects(
    () => transact(docClient)({ idempotentKey, userId, amount: "10", type: "debit" }),
    { message: ERROR.idempotency }
  )
})

test("fails with default error when no table found", async () => {
  await client.send(new DeleteTableCommand({ TableName: TRANSACTIONS }));

  const userId = "u9"
  const idempotentKey = "tx11"

  await assert.rejects(
    () => transact(docClient)({ idempotentKey, userId, amount: "20", type: "credit" }),
    { message: ERROR.default }
  )
})

test("fails on zero/negative amount", async () => {
  const userId = "u7"
  await assert.rejects(
    () => transact(docClient)({ idempotentKey: "tx7", userId, amount: "0", type: "credit" }),
    { message: ERROR.amountInvalid }
  )
  await assert.rejects(
    () => transact(docClient)({ idempotentKey: "tx8", userId, amount: "-10", type: "debit" }),
    { message: ERROR.amountInvalid }
  )
  await assert.rejects(
    () => transact(docClient)({ idempotentKey: "tx9", userId, amount: "foo", type: "debit" }),
    { message: ERROR.amountNaN }
  )
})

