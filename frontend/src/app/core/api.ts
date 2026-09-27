import { Injectable } from '@angular/core';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Thin fetch wrapper for the Python API: JSON in, JSON out, `{ok:false,error}` becomes an ApiError. */
@Injectable({ providedIn: 'root' })
export class Api {
  async get<T = any>(path: string, opts: { quiet401?: boolean } = {}): Promise<T> {
    return this.request<T>(path, undefined, opts);
  }

  async post<T = any>(path: string, body: unknown = {}): Promise<T> {
    return this.request<T>(path, body);
  }

  private async request<T>(path: string, body?: unknown, opts: { quiet401?: boolean } = {}): Promise<T> {
    const init: RequestInit = body === undefined ? {} : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
    let res: Response;
    try {
      res = await fetch(path, { credentials: 'same-origin', ...init });
    } catch {
      throw new ApiError('Network error — check your connection', 0);
    }
    let data: any = {};
    try { data = await res.json(); } catch { /* non-JSON */ }
    if (res.status === 401 && !opts.quiet401 && !path.startsWith('/api/auth') && !path.startsWith('/api/public')) {
      location.href = '/login';
      throw new ApiError('Signed out', 401);
    }
    if (!res.ok || data.ok === false) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
    return data as T;
  }
}
