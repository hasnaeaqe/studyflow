// frontend/src/app/services/user.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private userSubject = new BehaviorSubject<any>(null);
  user$ = this.userSubject.asObservable();

  constructor() {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        this.userSubject.next(JSON.parse(storedUser));
      } catch (e) {
        console.error('Erreur parsing user:', e);
      }
    }
  }

  updateUser(user: any) {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      this.userSubject.next(user);
      console.log('UserService: utilisateur mis à jour', user);
    }
  }

  getUser() {
    return this.userSubject.value;
  }
}