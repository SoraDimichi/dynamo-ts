import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"

const endpoint = process.env.DYNAMODB_ENDPOINT || "http://localhost:8000"
const client = new DynamoDBClient({ region: "local", endpoint })
const docClient = DynamoDBDocumentClient.from(client)

const runMigration = () =>
  client
    .send(new CreateTableCommand({
      TableName: "TestTable",
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST"
    }))
    .catch(err => err.name === "ResourceInUseException" ? null : Promise.reject(err))
    .then(() =>
      docClient.send(new PutCommand({
        TableName: "TestTable",
        Item: { id: "1", name: "default" }
      }))
    )
    .then(() => console.log("Migration complete"))
    .catch(err => console.error(err))

runMigration()
