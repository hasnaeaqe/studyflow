import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-sessions-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sessions-management.component.html',
  styleUrls: ['./sessions-management.component.scss']
})
export class SessionsManagementComponent implements OnInit {
  sessions: any[] = [];
  filteredSessions: any[] = [];
  
  searchTerm: string = '';
  selectedStatus: string = 'tous';
  selectedPriority: string = 'tous';
  
  showSessionModal = false;
  currentSession: any = {};
  isLoading = true;
  
  // Stats
  stats = {
    total: 0,
    completed: 0,
    inProgress: 0,
    planned: 0,
    cancelled: 0,
    missed: 0
  };
  
  constructor(private http: HttpClient) {}
  
  ngOnInit() {
    this.loadSessions();
    this.loadStats();
  }
  
  loadSessions() {
  this.http.get('http://localhost:3000/api/admin/sessions').subscribe({
    next: (data: any) => {
      console.log('📊 Sessions reçues du backend:', data.length); // ← AJOUTE CE LOG
      this.sessions = data;
      this.filteredSessions = data;
      this.isLoading = false;
    },
    error: (err) => {
      console.error('Erreur chargement sessions:', err);
      this.isLoading = false;
    }
  });
}
  
  loadStats() {
    this.http.get('http://localhost:3000/api/admin/sessions-stats').subscribe({
      next: (data: any) => {
        this.stats = data;
      },
      error: (err) => console.error('Erreur chargement stats:', err)
    });
  }
  
onSearch() {
  this.applyFilters();
}

  applyFilters() {
    let filtered = [...this.sessions];
    
    // Filtre par recherche textuelle
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(session => 
        session.title?.toLowerCase().includes(term) ||
        session.subject?.toLowerCase().includes(term) ||
        session.user?.toLowerCase().includes(term)
      );
    }
    
    // Filtre par statut
    if (this.selectedStatus && this.selectedStatus !== 'tous') {
      filtered = filtered.filter(session => session.status === this.selectedStatus);
    }
    
    // Filtre par priorité
    if (this.selectedPriority && this.selectedPriority !== 'tous') {
      filtered = filtered.filter(session => session.priority === this.selectedPriority);
    }
    
    this.filteredSessions = filtered;
  }
  onStatusChange() {
    this.loadSessions(); // Recharge avec le filtre
  }
  
  onPriorityChange() {
    this.loadSessions(); // Recharge avec le filtre
  }
  
  // Stats
  getCompletedCount(): number {
    return this.stats.completed;
  }
  
  getInProgressCount(): number {
    return this.stats.inProgress;
  }
  
  getPlannedCount(): number {
    return this.stats.planned;
  }
  
  getCancelledCount(): number {
    return this.stats.cancelled + this.stats.missed;
  }
  
  getUserInitials(fullName: string): string {
    const parts = fullName.split(' ');
    return (parts[0]?.charAt(0) || '') + (parts[1]?.charAt(0) || '');
  }
  
  getPriorityLabel(priority: string): string {
    const labels: {[key: string]: string} = {
      high: 'Haute',
      medium: 'Moyenne',
      low: 'Basse'
    };
    return labels[priority] || priority;
  }
  
  getStatusLabel(status: string): string {
    const labels: {[key: string]: string} = {
      completed: 'Terminée',
      in_progress: 'En cours',
      planned: 'Planifiée',
      cancelled: 'Annulée',
      missed: 'Manquée'
    };
    return labels[status] || status;
  }
  
  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  openSessionDetails(session: any) {
    this.http.get(`http://localhost:3000/api/admin/sessions/${session.id}`).subscribe({
      next: (data: any) => {
        this.currentSession = data;
        this.showSessionModal = true;
      },
      error: (err) => console.error(err)
    });
  }
  
  closeModal() {
    this.showSessionModal = false;
    this.currentSession = {};
  }
}