import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
    // Variables pour le modal
showUserModal = false;
isEditingUser = false;
currentUser: any = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'user',
  status: 'active'
};

openAddUserModal() {
  this.isEditingUser = false;
  this.currentUser = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'user',
    status: 'active'
  };
  this.showUserModal = true;
}

openEditUserModal(user: any) {
  this.isEditingUser = true;
  this.currentUser = { ...user };
  this.showUserModal = true;
}

saveUser() {
  if (this.isEditingUser) {
    // Modifier utilisateur
    this.http.put(`http://localhost:3000/api/admin/users/${this.currentUser.id}`, this.currentUser).subscribe({
      next: () => {
        this.loadUsers();
        this.showUserModal = false;
        this.showToast('Utilisateur modifié avec succès');
      },
      error: (err) => console.error(err)
    });
  } else {
    // Ajouter utilisateur
    this.http.post('http://localhost:3000/api/admin/users', this.currentUser).subscribe({
      next: () => {
        this.loadUsers();
        this.showUserModal = false;
        this.showToast('Utilisateur ajouté avec succès');
      },
      error: (err) => console.error(err)
    });
  }
}

deleteUser(userId: string) {
  if (confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
    this.http.delete(`http://localhost:3000/api/admin/users/${userId}`).subscribe({
      next: () => {
        this.loadUsers();
        this.showToast('Utilisateur supprimé');
      },
      error: (err) => console.error(err)
    });
  }
}

showToast(message: string) {
  // À implémenter avec un toast ou snackbar
  alert(message);
}

closeModal() {
  this.showUserModal = false;
}
  // Données du dashboard
  stats = {
    totalUsers: 0,
    activeUsers: 0,
    totalSessions: 0,
    totalHours: 0,
    totalHoursStudied: 0,
    bannedUsers: 0,
    newUsersLast7d: 0,
    sessionsLast7d: 0
  };
  
  // Variables pour la recherche
  searchTerm: string = '';
  globalSearchTerm: string = '';
  selectedStatus: string = 'tous';
  
  // Tableaux de données
  users: any[] = [];
  filteredUsers: any[] = [];
  activities: any[] = [];
  filteredActivities: any[] = [];
  
  // Données pour les graphiques
  days = [
    { name: 'Lun', sessionsHeight: '60%', hoursHeight: '48%' },
    { name: 'Mar', sessionsHeight: '80%', hoursHeight: '72%' },
    { name: 'Mer', sessionsHeight: '52%', hoursHeight: '45%' },
    { name: 'Jeu', sessionsHeight: '92%', hoursHeight: '86%' },
    { name: 'Ven', sessionsHeight: '100%', hoursHeight: '95%' },
    { name: 'Sam', sessionsHeight: '65%', hoursHeight: '55%' },
    { name: 'Dim', sessionsHeight: '38%', hoursHeight: '28%' }
  ];

  donutSubjectStats = [
    { name: 'Mathématiques', percentage: 42, color: 'var(--accent)', colorClass: 'c-blue', dasharray: '131.9 314', dashoffset: '78.5' },
    { name: 'Informatique', percentage: 28, color: 'var(--green)', colorClass: 'c-green', dasharray: '87.9 314', dashoffset: '-53.4' },
    { name: 'Physique', percentage: 15, color: 'var(--amber)', colorClass: 'c-amber', dasharray: '47.1 314', dashoffset: '-141.3' }
  ];

  subjectProgress = [
    { name: 'Mathématiques', percentage: 42, color: 'var(--accent)' },
    { name: 'Informatique', percentage: 28, color: 'var(--green)' },
    { name: 'Physique', percentage: 15, color: 'var(--amber)' },
    { name: 'Anglais', percentage: 9, color: 'var(--red)' }
  ];

  totalCoverage = 85;
  isLoading = true;
  userName = '';
  
  constructor(
    private http: HttpClient,
    private router: Router
  ) {}
  
  ngOnInit() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    this.userName = `${user.firstName} ${user.lastName}`;
    
    this.loadDashboardData();
    this.loadUsers();
    this.loadActivity();
  }
  
  // Applique tous les filtres (recherche + statut)
  applyFilters() {
    let filtered = [...this.users];
    
    // Filtre par recherche dans le tableau
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(user => 
        user.firstName.toLowerCase().includes(term) ||
        user.lastName.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
      );
    }
    
    // Filtre par statut
    if (this.selectedStatus && this.selectedStatus !== 'tous') {
      filtered = filtered.filter(user => user.status === this.selectedStatus);
    }
    
    this.filteredUsers = filtered;
  }
  
  // Recherche dans le tableau des utilisateurs
  filterUsers() {
    this.applyFilters();
  }
  
  // Changement de statut
  onStatusChange() {
    this.applyFilters();
  }
  
  // Recherche globale (topbar)
 onGlobalSearch() {
  const term = this.globalSearchTerm.toLowerCase().trim();
  console.log('🔍 Recherche globale - Terme:', term);
  console.log('📊 Nombre d\'utilisateurs:', this.users.length);
  console.log('📋 Nombre d\'activités:', this.activities.length);
  
  if (!term) {
    this.filteredUsers = [...this.users];
    this.filteredActivities = [...this.activities];
    console.log('✅ Réinitialisation des filtres');
    return;
  }
  
  this.filteredUsers = this.users.filter(user => {
    const match = user.firstName.toLowerCase().includes(term) ||
      user.lastName.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term);
    return match;
  });
  
  this.filteredActivities = this.activities.filter(activity => {
    const match = activity.user.toLowerCase().includes(term) ||
      activity.action.toLowerCase().includes(term);
    return match;
  });
  
  console.log('🎯 Utilisateurs filtrés:', this.filteredUsers.length);
  console.log('🎯 Activités filtrées:', this.filteredActivities.length);
}
  // Réinitialiser la recherche globale
  clearGlobalSearch() {
    this.globalSearchTerm = '';
    this.filteredUsers = [...this.users];
    this.filteredActivities = [...this.activities];
  }
  
  loadDashboardData() {
    this.http.get('http://localhost:3000/api/admin/dashboard').subscribe({
      next: (data: any) => {
        this.stats = {
          totalUsers: data.kpis?.totalUsers || 0,
          activeUsers: data.kpis?.activeUsers || 0,
          totalSessions: data.kpis?.totalSessions || 0,
          totalHours: data.kpis?.totalHoursStudied || 0,
          totalHoursStudied: data.kpis?.totalHoursStudied || 0,
          bannedUsers: data.kpis?.bannedUsers || 0,
          newUsersLast7d: data.kpis?.newUsersLast7d || 0,
          sessionsLast7d: data.kpis?.sessionsLast7d || 0
        };
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur chargement dashboard:', err);
        this.stats = {
          totalUsers: 1248,
          activeUsers: 892,
          totalSessions: 4573,
          totalHours: 28490,
          totalHoursStudied: 28490,
          bannedUsers: 14,
          newUsersLast7d: 124,
          sessionsLast7d: 847
        };
        this.isLoading = false;
      }
    });
  }
  
  loadUsers() {
    this.http.get('http://localhost:3000/api/admin/users').subscribe({
      next: (data: any) => {
        this.users = data;
        this.filteredUsers = data;
      },
      error: (err) => {
        console.error('Erreur chargement utilisateurs:', err);
        this.users = [
          { id: 1, firstName: 'Sara', lastName: 'Moukhliss', email: 'sara@etudiant.ma', sessions: 47, hours: 128, status: 'active', registeredAt: '2026-01-15' },
          { id: 2, firstName: 'Karim', lastName: 'Benali', email: 'karim@etudiant.ma', sessions: 22, hours: 61, status: 'inactive', registeredAt: '2026-02-10' },
          { id: 3, firstName: 'Nadia', lastName: 'Oujda', email: 'nadia@etudiant.ma', sessions: 3, hours: 5, status: 'banned', registeredAt: '2026-03-05' },
          { id: 4, firstName: 'Youssef', lastName: 'Amrani', email: 'youssef@etudiant.ma', sessions: 89, hours: 210, status: 'active', registeredAt: '2025-11-01' },
          { id: 5, firstName: 'Leila', lastName: 'Hassani', email: 'leila@etudiant.ma', sessions: 64, hours: 177, status: 'active', registeredAt: '2025-12-10' }
        ];
        this.filteredUsers = this.users;
      }
    });
  }
  
  loadActivity() {
    this.http.get('http://localhost:3000/api/admin/activity').subscribe({
      next: (data: any) => {
        this.activities = data;
        this.filteredActivities = data;
      },
      error: (err) => {
        console.error('Erreur chargement activité:', err);
        this.activities = [
          { user: 'Sara Moukhliss', action: 'a atteint son objectif hebdomadaire (15h)', time: 'Il y a 12 min' },
          { user: 'Groupe IA & ML', action: 'créé — 5 membres', time: 'Il y a 45 min' },
          { user: '47 sessions', action: 'planifiées pour demain', time: 'Il y a 1h' },
          { user: 'Nadia Oujda', action: 'suspendue après signalements', time: 'Il y a 2h' }
        ];
        this.filteredActivities = this.activities;
      }
    });
  }
  
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    this.router.navigate(['/login']);
  }
  
  getUserInitials(firstName: string, lastName: string): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  
  getStatusClass(status: string): string {
    switch(status) {
      case 'active': return 's-active';
      case 'inactive': return 's-inactive';
      case 'banned': return 's-banned';
      default: return 's-inactive';
    }
  }
}