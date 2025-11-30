// Standardized API error responses

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage: string = "An error occurred"
): Response {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: error.message,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof Error) {
    return Response.json(
      {
        error: error.message || defaultMessage,
      },
      { status: 500 }
    );
  }

  return Response.json(
    {
      error: defaultMessage,
    },
    { status: 500 }
  );
}

