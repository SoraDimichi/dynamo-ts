import { createServer } from "http"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb"

const db = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "local", endpoint: "http://localhost:8000" })
)

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`)
  const method = req.method ?? "GET"

  if (method === "POST" && url.pathname === "/users") {
    let body = ""
    req.on("data", chunk => (body += chunk))
    req.on("end", () => {
      const { id, name } = JSON.parse(body)
      db.send(new PutCommand({ TableName: "Users", Item: { id, name } }))
        .then(() => {
          res.writeHead(200, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ ok: true }))
        })
        .catch((err) => {
          res.writeHead(500)
          res.end(err.message)
        })
    })
  }

  else if (method === "GET" && url.pathname.startsWith("/users/")) {
    const id = url.pathname.split("/")[2]
    db.send(new GetCommand({ TableName: "Users", Key: { id } }))
      .then((r) => {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify(r.Item || {}))
      })
      .catch((err) => {
        res.writeHead(500)
        res.end(err.message)
      })
  }

  else {
    res.writeHead(404)
    res.end("Not found")
  }
})

server.listen(3000, () => {
  console.log("? Server running at http://localhost:3000")
})
