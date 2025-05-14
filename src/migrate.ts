import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb"

const db = new DynamoDBClient({
  region: "local",
  endpoint: "http://dynamodb:8000"
})

db.send(new CreateTableCommand({
  TableName: "Users",
  AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
  KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  BillingMode: "PAY_PER_REQUEST"
}))
  .then(() => console.log("? Users table created"))
  .catch((err) => {
    if (err.name === "ResourceInUseException") console.log("?? Table already exists")
    else throw err
  })
