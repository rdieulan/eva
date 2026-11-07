// Custom API Error class that preserves error array structure

export class ApiError extends Error {
  public readonly errors: string[];

  constructor(errors: string[], fallbackMessage: string) {
    const message = errors.length > 0 ? errors.join('. ') : fallbackMessage;
    super(message);
    this.name = 'ApiError';
    this.errors = errors.length > 0 ? errors : [fallbackMessage];
  }

  static fromResponse(data: { errors?: string[] }, fallbackMessage: string): ApiError {
    return new ApiError(data.errors || [], fallbackMessage);
  }

  /**
   * Build the error of a failed response from its body. The body is not
   * always ours: a proxy that cannot reach the API, or a gateway timeout,
   * answers with an empty or HTML body. Those read as the fallback message
   * instead of a JSON parsing error.
   */
  static async fromFailedResponse(response: Response, fallbackMessage: string): Promise<ApiError> {
    return ApiError.fromResponse(await readJsonBody(response), fallbackMessage);
  }
}

/**
 * Parse a response body as JSON, or give back an empty object when it is
 * empty or not JSON at all
 */
export async function readJsonBody(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (text.trim() === '') return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
