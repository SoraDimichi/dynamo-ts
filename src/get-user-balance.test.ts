import { test, before, after } from "node:test"
import assert from "node:assert"
import { GenericContainer, type StartedTestContainer } from "testcontainers"
import { CreateTableCommand, DeleteTableCommand, type DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { type DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"
import { BALANCES as TableName } from "./consts.ts"
import { ERROR, getUserBalance } from "./get-user-balance.ts"
import { createClient, createDocumentClient } from "./create-client.ts"

let container: StartedTestContainer;
let client: DynamoDBClient;
let docClient: DynamoDBDocumentClient;

export const startDynamoDbContainer = (): Promise<StartedTestContainer> =>
  new GenericContainer('amazon/dynamodb-local')
    .withCommand(['-jar', 'DynamoDBLocal.jar', '-sharedDb', '-inMemory'])
    .withExposedPorts(8000)
    .start()

before(async () => {
  process.env.AWS_ACCESS_KEY_ID = 'test'
  process.env.AWS_SECRET_ACCESS_KEY = 'test'
  process.env.AWS_REGION = 'us-west-2'

  container = await startDynamoDbContainer();
  const endpoint = `http://${container.getHost()}:${container.getMappedPort(8000)}`
  process.env.DYNAMODB_ENDPOINT = endpoint

  client = createClient(endpoint)
  docClient = createDocumentClient(client)

  await client.send(new CreateTableCommand({
    TableName,
    AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    BillingMode: "PAY_PER_REQUEST"
  }))
})

after(async () => {
  await container.stop()
  docClient.destroy();
  client.destroy();
})

test("returns user balance if present", async () => {
  await docClient.send(new PutCommand({ TableName, Item: { id: "1", balance: 150 } }))

  const result = await getUserBalance(docClient)({ userId: "1" })
  assert.strictEqual(result, 150)
})

test("returns user balance, even if it zero", async () => {
  await docClient.send(new PutCommand({ TableName, Item: { id: "1", balance: 0 } }))

  const result = await getUserBalance(docClient)({ userId: "1" })
  assert.strictEqual(result, 0)
})

test("throws error if user not found", async () => {
  await docClient.send(new PutCommand({ TableName, Item: { id: "1", balance: 150 } }))

  await assert.rejects(
    () => getUserBalance(docClient)({ userId: "not-exist" }),
    { message: ERROR.notFound }
  )
})

test("returns default balance if balance is undefined", async () => {
  await docClient.send(new PutCommand({ TableName, Item: { id: "2", } }))

  const result = await getUserBalance(docClient)({ userId: "2" })
  assert.strictEqual(result, 100)
})

test("returns default balance if balance is null", async () => {
  await docClient.send(new PutCommand({ TableName, Item: { id: "3", balance: null } }))

  const result = await getUserBalance(docClient)({ userId: "3" })
  assert.strictEqual(result, 100)
})

test("fails with default error when no table found", async () => {
  await client.send(new DeleteTableCommand({ TableName }));

  await assert.rejects(
    () => getUserBalance(docClient)({ userId: "4" }),
    { message: ERROR.default }
  )
})
