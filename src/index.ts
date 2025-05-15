import { createServer } from "http"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb"

const endpoint = process.env.DYNAMODB_ENDPOINT || "http://localhost:8000"
const client = new DynamoDBClient({ region: "local", endpoint })
const docClient = DynamoDBDocumentClient.from(client)

const server = createServer((req, res) => {
  return req.method === "GET" && req.url === "/item"
    ? docClient
      .send(new GetCommand({ TableName: "TestTable", Key: { id: "1" } }))
      .then(data => (res.writeHead(200, { "Content-Type": "application/json" }), res.end(JSON.stringify(data.Item || {}))))
      .catch(err => (res.writeHead(500), res.end(err.message)))
    : (res.writeHead(404), res.end("Not found"))
})

server.listen(3000, () => console.log("Server running at http://localhost:3000"))
