// main-layout.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';  // ← Ajouter

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent implements OnInit {  // ← Ajouter OnInit
  unreadCount: number = 0;  // ← Ajouter cette propriété

  constructor(
    private router: Router,
    private http: HttpClient  // ← Ajouter HttpClient
  ) {}

  ngOnInit() {  // ← Ajouter ngOnInit
    this.loadUnreadCount();
  }

  loadUnreadCount() {  // ← Ajouter cette méthode
    this.http.get('http://localhost:3000/api/admin/notifications/unread-count').subscribe({
      next: (data: any) => {
        this.unreadCount = data.count || 0;
      },
      error: (err) => {
        console.error('Erreur chargement compteur:', err);
        this.unreadCount = 0;
      }
    });
  }

  isActive(route: string): boolean {
    return this.router.url === route;
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    this.router.navigate(['/landing']);
  }
}