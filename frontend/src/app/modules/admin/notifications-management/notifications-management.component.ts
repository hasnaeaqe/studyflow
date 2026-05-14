import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-notifications-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notifications-management.component.html',
  styleUrls: ['./notifications-management.component.scss']
})
export class NotificationsManagementComponent implements OnInit {
  notifications: any[] = [];
  filteredNotifications: any[] = [];
  
  searchTerm: string = '';
  selectedType: string = 'tous';
  selectedStatus: string = 'tous';
  
  stats = {
    total: 0,
    unread: 0,
    read: 0,
    byType: {
      member_joined: 0,
      session_cancelled: 0,
      goal_achieved: 0,
      group_invitation: 0,
      session_reminder: 0,
      weekly_report: 0
    }
  };
  
  selectedNotifications: Set<string> = new Set();
  selectAll = false;
  
  isLoading = true;
  showDeleteConfirm = false;
  notificationToDelete: any = null;
  
  constructor(private http: HttpClient) {}
  
  ngOnInit() {
    this.loadNotifications();
    // Rafraîchir toutes les 30 secondes
    setInterval(() => this.loadNotifications(), 30000);
  }
  
  loadNotifications() {
    this.http.get('http://localhost:3000/api/admin/notifications').subscribe({
      next: (data: any) => {
        this.notifications = data;
        this.filteredNotifications = data;
        this.calculateStats();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur chargement notifications:', err);
        this.isLoading = false;
      }
    });
  }
  
calculateStats() {
  this.stats.total = this.notifications.length;
  this.stats.unread = this.notifications.filter(n => !n.isRead).length;
  this.stats.read = this.stats.total - this.stats.unread;
  
  // Réinitialiser les compteurs par type
  this.stats.byType = {
    member_joined: 0,
    session_cancelled: 0,
    goal_achieved: 0,
    group_invitation: 0,
    session_reminder: 0,
    weekly_report: 0
  };
  
  this.notifications.forEach(n => {
    const type = n.type as keyof typeof this.stats.byType;
    if (this.stats.byType[type] !== undefined) {
      this.stats.byType[type]++;
    }
  });
}
  
  applyFilters() {
    let filtered = [...this.notifications];
    
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(term) ||
        n.body.toLowerCase().includes(term) ||
        n.userName?.toLowerCase().includes(term)
      );
    }
    
    if (this.selectedType !== 'tous') {
      filtered = filtered.filter(n => n.type === this.selectedType);
    }
    
    if (this.selectedStatus !== 'tous') {
      filtered = filtered.filter(n => this.selectedStatus === 'unread' ? !n.isRead : n.isRead);
    }
    
    this.filteredNotifications = filtered;
    this.updateSelectAll();
  }
  
  onSearch() { this.applyFilters(); }
  onTypeChange() { this.applyFilters(); }
  onStatusChange() { this.applyFilters(); }
  
  markAsRead(notification: any) {
    if (!notification.isRead) {
      this.http.put(`http://localhost:3000/api/admin/notifications/${notification.id}/read`, {}).subscribe({
        next: () => {
          notification.isRead = true;
          this.calculateStats();
        }
      });
    }
  }
  
  markAllAsRead() {
    this.http.put('http://localhost:3000/api/admin/notifications/mark-all-read', {}).subscribe({
      next: () => {
        this.notifications.forEach(n => n.isRead = true);
        this.filteredNotifications.forEach(n => n.isRead = true);
        this.calculateStats();
      }
    });
  }
  
  deleteNotification(notification: any) {
    this.notificationToDelete = notification;
    this.showDeleteConfirm = true;
  }
  
  confirmDelete() {
    if (this.notificationToDelete) {
      this.http.delete(`http://localhost:3000/api/admin/notifications/${this.notificationToDelete.id}`).subscribe({
        next: () => {
          this.notifications = this.notifications.filter(n => n.id !== this.notificationToDelete.id);
          this.filteredNotifications = this.filteredNotifications.filter(n => n.id !== this.notificationToDelete.id);
          this.calculateStats();
          this.showDeleteConfirm = false;
          this.notificationToDelete = null;
        }
      });
    }
  }
  
  cancelDelete() {
    this.showDeleteConfirm = false;
    this.notificationToDelete = null;
  }
  
  toggleSelect(notificationId: string) {
    if (this.selectedNotifications.has(notificationId)) {
      this.selectedNotifications.delete(notificationId);
    } else {
      this.selectedNotifications.add(notificationId);
    }
    this.updateSelectAll();
  }
  
  toggleSelectAll() {
    this.selectAll = !this.selectAll;
    if (this.selectAll) {
      this.filteredNotifications.forEach(n => this.selectedNotifications.add(n.id));
    } else {
      this.selectedNotifications.clear();
    }
  }
  
  updateSelectAll() {
    this.selectAll = this.filteredNotifications.length > 0 && 
                     this.filteredNotifications.every(n => this.selectedNotifications.has(n.id));
  }
  
  deleteSelected() {
    if (this.selectedNotifications.size === 0) return;
    
    const ids = Array.from(this.selectedNotifications);
    this.http.delete('http://localhost:3000/api/admin/notifications', { body: { ids } }).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(n => !this.selectedNotifications.has(n.id));
        this.filteredNotifications = this.filteredNotifications.filter(n => !this.selectedNotifications.has(n.id));
        this.selectedNotifications.clear();
        this.selectAll = false;
        this.calculateStats();
      }
    });
  }
  
  getTypeIcon(type: string): string {
    const icons: {[key: string]: string} = {
      session_reminder: '⏰',
      group_invitation: '👥',
      goal_achieved: '🎯',
      session_comment: '💬',
      member_joined: '➕',
      session_cancelled: '❌',
      weekly_report: '📊'
    };
    return icons[type] || '🔔';
  }
  
  getTypeLabel(type: string): string {
    const labels: {[key: string]: string} = {
      session_reminder: 'Rappel de session',
      group_invitation: 'Invitation groupe',
      goal_achieved: 'Objectif atteint',
      session_comment: 'Commentaire',
      member_joined: 'Nouveau membre',
      session_cancelled: 'Session annulée',
      weekly_report: 'Rapport hebdomadaire'
    };
    return labels[type] || type;
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
    return date.toLocaleDateString('fr-FR');
  }
}