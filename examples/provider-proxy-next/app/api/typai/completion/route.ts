import { handleTypaiNextCompletionRequest } from "../../../../src/handler";
import { readProviderProxyEnv } from "../../../../src/validateEnv";

export async function POST(request: Request): Promise<Response> {
  return handleTypaiNextCompletionRequest(request, readProviderProxyEnv());
}

export async function GET(request: Request): Promise<Response> {
  return handleTypaiNextCompletionRequest(request, readProviderProxyEnv());
}

export async function OPTIONS(request: Request): Promise<Response> {
  return handleTypaiNextCompletionRequest(request, readProviderProxyEnv());
}
