import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  xpPoints: number;
  level: number;
  streakDays: number;
  weeklyGoalHours: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://localhost:3000/api/auth';
  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadStoredUser();
  }

  private loadStoredUser() {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        this.userSubject.next(user);
      } catch(e) {
        console.error('Erreur parsing user', e);
      }
    }
  }

  getUser(): User | null {
    return this.userSubject.value;
  }

  getInitials(user: User | null): string {
    if (!user) return '?';
    return `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`;
  }

  getFullName(user: User | null): string {
    if (!user) return 'Chargement...';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Utilisateur';
  }

  loadProfile(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/profile`).pipe(
      tap(user => this.updateUser(user))
    );
  }

  updateProfile(profileData: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/profile`, profileData).pipe(
      tap(updatedUser => this.updateUser(updatedUser))
    );
  }

  updateUser(user: User) {
    this.userSubject.next(user);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('userName', `${user.firstName} ${user.lastName}`);
    localStorage.setItem('userRole', user.role);
  }

  clearUser() {
    this.userSubject.next(null);
    localStorage.removeItem('user');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
  }
}