// This is orval's configured "mutator" (see orval.config.ts → override.mutator).
// Every generated hook calls this instead of raw fetch. It is NOT generated —
// orval expects it to already exist at this path.
//
// RECONSTRUCTION NOTE: this exact file was missing from the project export
// (see SETUP.md). This version is a best-effort rewrite, not the recovered
// original — it's written to match this app's own API conventions (every
// route responds with `{ error: "message" }` on failure, and several DELETE
// endpoints return 204 with no body), which is the part that actually
// mattered to get right. If your original had extra behavior (auth headers,
// retries, etc.), re-add it here.

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const customFetch = async <T>(url: string, options: RequestInit): Promise<T> => {
  const response = await fetch(url, options);

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "error" in body) {
        message = String((body as { error: unknown }).error);
      }
    } catch {
      // Response body wasn't JSON (or was empty) — fall back to the generic message above.
    }
    throw new ApiError(message, response.status);
  }

  // Several endpoints (deletes, logout, etc.) return 204 with no body.
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return undefined as T;
};

export default customFetch;
