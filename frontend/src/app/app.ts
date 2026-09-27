import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Theme } from './core/theme';
import { ConfirmHost, ToastHost } from './ui/hosts';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHost, ConfirmHost],
  template: `<router-outlet /><app-toasts /><app-confirm-host />`,
})
export class App {
  // Created up front so the saved light/dark choice is applied and kept in sync.
  private theme = inject(Theme);
}
