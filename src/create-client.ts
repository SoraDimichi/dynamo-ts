import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"


export const createClient = (endpoint: string) => new DynamoDBClient({ region: "local", endpoint });
export const createDocumentClient = (client: DynamoDBClient) => DynamoDBDocumentClient
  .from(client)

