import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler } from '@angular/common/http';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}


  intercept(req: HttpRequest<any>, next: HttpHandler) {
    const token = this.authService.getToken();
    console.log('🔑 INTERCEPTOR - Token:', token ? token.substring(0, 50) + '...' : 'NON');
    
    if (token) {
      const cloned = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
      console.log('📤 INTERCEPTOR - En-tête ajouté pour:', req.url);
      return next.handle(cloned);
    }
    
    console.log('⚠️ INTERCEPTOR - Pas de token pour:', req.url);
    return next.handle(req);
  }
}