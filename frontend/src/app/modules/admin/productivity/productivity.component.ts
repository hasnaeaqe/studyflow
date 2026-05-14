import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-productivity',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './productivity.component.html',
  styleUrls: ['./productivity.component.scss']
})
export class ProductivityComponent implements OnInit {
  isLoading = true;
  
  globalStats = {
    avgCompletionRate: 0,
    totalHours: 0,
    totalSessions: 0,
    activeUsers: 0,
    avgStreak: 0
  };
  
  topUsers: any[] = [];
  subjectProductivity: any[] = [];
  weeklyActivity: any[] = [];
  selectedPeriod: string = 'week';
  
  constructor(private http: HttpClient) {}
  
  ngOnInit() {
    this.loadData();
  }
  
  loadData() {
    this.http.get('http://localhost:3000/api/admin/productivity').subscribe({
      next: (data: any) => {
        this.globalStats = data.globalStats;
        this.topUsers = data.topUsers;
        this.subjectProductivity = data.subjectProductivity;
        this.weeklyActivity = data.weeklyActivity;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur chargement productivité:', err);
        this.isLoading = false;
      }
    });
  }
  
  // ============================================
  // MÉTHODES AJOUTÉES POUR LE TEMPLATE
  // ============================================
  
  // Calcul de la hauteur des barres
    getBarHeight(sessions: number): string {
      // Trouver le maximum de sessions parmi tous les jours
      const maxSessions = Math.max(...this.weeklyActivity.map(w => w.sessions), 1);
      
      // Éviter la division par zéro
      if (maxSessions === 0) return '20%';
      
      // Calculer la hauteur relative (minimum 20% pour être visible)
      const height = (sessions / maxSessions) * 100;
      return `${Math.max(height, 20)}%`;
    }
  
    // Calcul de la largeur des barres horizontales
  getBarWidth(sessions: number): string {
    const maxSessions = Math.max(...this.weeklyActivity.map(w => w.sessions), 1);
    if (maxSessions === 0) return '0%';
    const width = (sessions / maxSessions) * 100;
    return `${width}%`;
  }
  // Total des sessions de la semaine
  getTotalWeeklySessions(): number {
    return this.weeklyActivity.reduce((acc, day) => acc + day.sessions, 0);
  }
  
  // Classe CSS pour le taux de complétion
  getCompletionRateClass(rate: number): string {
    if (rate >= 80) return 'high';
    if (rate >= 60) return 'medium';
    return 'low';
  }
  
  // Couleur pour le taux de complétion
  getCompletionRateColor(rate: number): string {
    if (rate >= 80) return 'var(--green)';
    if (rate >= 60) return 'var(--amber)';
    return 'var(--red)';
  }
  
  // Couleur pour l'avatar utilisateur (dégradé)
  getUserColor(index: number): string {
    const colors = ['#4f8ef7', '#1fc87a', '#f5a623', '#f04b6f', '#8b6cf7', '#22d07a', '#f78e4f'];
    return colors[index % colors.length];
  }
  
  // Initiales de l'utilisateur
  getUserInitials(name: string): string {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
}