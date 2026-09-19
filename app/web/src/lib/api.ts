/** route handler 의 오류 응답. 클라이언트 fetchJson 이 { error } 를 읽는다 */
export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/** body 를 JSON 으로 읽고 validate 로 좁힌다. 실패하면 null */
export async function parseJson<T>(
  request: Request,
  validate: (raw: unknown) => T | null,
): Promise<T | null> {
  try {
    return validate(await request.json());
  } catch {
    return null;
  }
}
