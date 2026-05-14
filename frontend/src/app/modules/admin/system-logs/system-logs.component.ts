import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface SystemLog {
  id: string;
  type: string;
  severity: string;
  message: string;
  createdAt: string;
  userId: string;
  ip: string;
}

@Component({
  selector: 'app-system-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './system-logs.component.html',
  styleUrls: ['./system-logs.component.scss']
})
export class SystemLogsComponent implements OnInit {
  logs: SystemLog[] = [];
  filteredLogs: SystemLog[] = [];
  
  searchTerm: string = '';
  selectedType: string = 'tous';
  selectedSeverity: string = 'tous';
  
  stats = {
    total: 0,
    info: 0,
    warning: 0,
    error: 0
  };
  
  isLoading = true;
  
  // Mapping des types
  typeLabels: Record<string, string> = {
    user_action: 'Action utilisateur',
    session: 'Session',
    group: 'Groupe',
    notification: 'Notification',
    error: 'Erreur système'
  };
  
  severityLabels: Record<string, string> = {
    info: 'Information',
    warning: 'Avertissement',
    error: 'Erreur'
  };
  
  constructor(private http: HttpClient) {}
  
  ngOnInit() {
    this.loadLogs();
    // Rafraîchir toutes les 30 secondes
    setInterval(() => this.loadLogs(), 30000);
  }
  
  loadLogs() {
    let url = 'http://localhost:3000/api/admin/system-logs';
    const params: string[] = [];
    
    if (this.selectedType !== 'tous') {
      params.push(`type=${this.selectedType}`);
    }
    if (this.selectedSeverity !== 'tous') {
      params.push(`severity=${this.selectedSeverity}`);
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    
    this.http.get<SystemLog[]>(url).subscribe({
      next: (data) => {
        this.logs = data;
        this.applyFilters();
        this.calculateStats();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur chargement logs:', err);
        this.isLoading = false;
      }
    });
  }
  
  calculateStats() {
    this.stats.total = this.logs.length;
    this.stats.info = this.logs.filter(l => l.severity === 'info').length;
    this.stats.warning = this.logs.filter(l => l.severity === 'warning').length;
    this.stats.error = this.logs.filter(l => l.severity === 'error').length;
  }
  
  applyFilters() {
    let filtered = [...this.logs];
    
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(term)
      );
    }
    
    this.filteredLogs = filtered;
  }
  
  onSearch() {
    this.applyFilters();
  }
  
  onTypeChange() {
    this.loadLogs();
  }
  
  onSeverityChange() {
    this.loadLogs();
  }
  
  getSeverityClass(severity: string): string {
    switch(severity) {
      case 'info': return 'severity-info';
      case 'warning': return 'severity-warning';
      case 'error': return 'severity-error';
      default: return '';
    }
  }
  
  getTypeLabel(type: string): string {
    return this.typeLabels[type] || type;
  }
  
  getSeverityLabel(severity: string): string {
    return this.severityLabels[severity] || severity;
  }
  
  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours} h`;
    if (days < 7) return `Il y a ${days} j`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }
}