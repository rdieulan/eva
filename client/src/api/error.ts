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
}
