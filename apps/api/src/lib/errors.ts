import { FastifyReply } from "fastify";

export interface ApiError {
  message: string;
  code: string;
  details?: unknown;
}

export function replyError(reply: FastifyReply, status: number, error: ApiError): FastifyReply {
  return reply.status(status).send(error);
}
