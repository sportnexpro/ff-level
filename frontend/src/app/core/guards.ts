import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Session } from './session';

// The server already redirects full page loads; these guards cover in-app navigation.

export const signedIn: CanActivateFn = async () => {
  const user = await inject(Session).loadMe();
  if (!user) {
    location.href = '/login';
    return false;
  }
  return true;
};

export const adminOnly: CanActivateFn = async () => {
  const router = inject(Router);
  const user = await inject(Session).loadMe();
  if (!user) {
    location.href = '/login';
    return false;
  }
  return user.role === 'admin' ? true : router.parseUrl('/panel');
};

export const signedOut: CanActivateFn = async () => {
  const router = inject(Router);
  const user = await inject(Session).loadMe();
  if (!user) return true;
  return router.parseUrl(user.role === 'admin' ? '/admin' : '/panel');
};
