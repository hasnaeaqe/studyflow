import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FilterByDayPipe } from './pipes/filter-by-day.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterByDayPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  // Données utilisateur
  user: any = {};
  userName = '';
  
  // Statistiques
  stats = {
    totalStudyHours: 0,
    completedSessions: 0,
    plannedSessions: 0,
    streakDays: 0,
    xpPoints: 0,
    level: 1,
    nextLevelXp: 200
  };
  
  // Matières
  subjects: any[] = [];
  selectedSubject: any = null;
  showSubjectModal = false;
  newSubject = { name: '', color: '#4f8ef7', priority: 'medium' };
  
  // Disponibilités
  availabilities: any[] = [];
  daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  dayNames: { [key: string]: string } = { 
    monday: 'Lun', tuesday: 'Mar', wednesday: 'Mer', 
    thursday: 'Jeu', friday: 'Ven', saturday: 'Sam', sunday: 'Dim' 
  };
  
  // Objectifs hebdomadaires
  weeklyGoals: any[] = [];
  
  // Sessions d'étude
  studySessions: any[] = [];
  upcomingSessions: any[] = [];
  
  // Planning généré
  generatedSchedule: any[] = [];
  showScheduleModal = false;
  
  // Notifications
  notifications: any[] = [];
  unreadCount = 0;
  showNotifications = false;
  
  // Groupes d'étude
  studyGroups: any[] = [];
  showGroupModal = false;
  newGroup = { name: '', description: '', isPublic: true, maxMembers: 10 };
  inviteCode = '';
  
  // États
  isLoading = true;
  activeTab = 'dashboard';
  
  constructor(
    private http: HttpClient,
    private router: Router
  ) {}
  
  ngOnInit() {
  console.log('🟢 Dashboard ngOnInit - Début');
  
  const userStr = localStorage.getItem('user');
  console.log('📦 User from localStorage:', userStr);
  
  if (userStr) {
    this.user = JSON.parse(userStr);
    this.userName = `${this.user.firstName} ${this.user.lastName}`;
    console.log('👤 UserName:', this.userName);
  }
  
  this.loadStats();
  this.loadSubjects();
  this.loadStudySessions();
  this.loadStudyGroups();
  this.loadNotifications();
  
  console.log('🟢 Fini - isLoading:', this.isLoading);
}
  
   get userInitials(): string {
    return this.userName.charAt(0).toUpperCase() + (this.userName.split(' ')[1]?.charAt(0) || '').toUpperCase();
  }

  get xpProgressPercent(): number {
    if (!this.stats.nextLevelXp) return 0;
    return (this.stats.xpPoints % this.stats.nextLevelXp) / this.stats.nextLevelXp * 100;
  }
  // Ajoute cette méthode (manquante)
  getTabTitle(): string {
    const titles: { [key: string]: string } = {
      dashboard: 'Tableau de bord',
      subjects: 'Mes matières',
      schedule: 'Planning d\'étude',
      groups: 'Groupes d\'étude',
      stats: 'Mes statistiques'
    };
    return titles[this.activeTab] || 'Tableau de bord';
  }
  
  loadUserData() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      this.user = JSON.parse(userStr);
      this.userName = `${this.user.firstName} ${this.user.lastName}`;
    }
  }
  
  loadStats() {
    this.http.get('http://localhost:3000/api/student/stats').subscribe({
      next: (data: any) => {
        this.stats = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur chargement stats:', err);
        // Données mockées
        this.stats = {
          totalStudyHours: 42.5,
          completedSessions: 18,
          plannedSessions: 24,
          streakDays: 7,
          xpPoints: 1250,
          level: 3,
          nextLevelXp: 2000
        };
        this.isLoading = false;
      }
    });
  }
  
  loadSubjects() {
    this.http.get('http://localhost:3000/api/student/subjects').subscribe({
      next: (data: any) => {
        this.subjects = data;
      },
      error: (err) => {
        console.error('Erreur chargement matières:', err);
        this.subjects = [
          { id: '1', name: 'Mathématiques', color: '#4f8ef7', priority: 'high', progress: 65 },
          { id: '2', name: 'Informatique', color: '#1fc87a', priority: 'high', progress: 45 },
          { id: '3', name: 'Physique', color: '#f5a623', priority: 'medium', progress: 30 },
          { id: '4', name: 'Anglais', color: '#f04b6f', priority: 'low', progress: 70 }
        ];
      }
    });
  }
  
  loadAvailabilities() {
    this.http.get('http://localhost:3000/api/student/availabilities').subscribe({
      next: (data: any) => {
        this.availabilities = data;
      },
      error: (err) => {
        console.error('Erreur chargement disponibilités:', err);
      }
    });
  }
  
  loadWeeklyGoals() {
    this.http.get('http://localhost:3000/api/student/weekly-goals').subscribe({
      next: (data: any) => {
        this.weeklyGoals = data;
      },
      error: (err) => {
        console.error('Erreur chargement objectifs:', err);
      }
    });
  }
  
  loadStudySessions() {
    this.http.get('http://localhost:3000/api/student/sessions').subscribe({
      next: (data: any) => {
        this.studySessions = data;
        this.filterUpcomingSessions();
      },
      error: (err) => {
        console.error('Erreur chargement sessions:', err);
        this.upcomingSessions = [
          { id: '1', title: 'Mathématiques - Analyse', subject: 'Mathématiques', plannedStart: '2026-05-15T14:00:00', duration: 120, priority: 'high' },
          { id: '2', title: 'Informatique - Algorithmes', subject: 'Informatique', plannedStart: '2026-05-16T10:00:00', duration: 90, priority: 'high' }
        ];
      }
    });
  }
  
  filterUpcomingSessions() {
    const now = new Date();
    this.upcomingSessions = this.studySessions
      .filter(s => new Date(s.plannedStart) > now)
      .sort((a, b) => new Date(a.plannedStart).getTime() - new Date(b.plannedStart).getTime())
      .slice(0, 5);
  }
  
  loadNotifications() {
    this.http.get('http://localhost:3000/api/student/notifications').subscribe({
      next: (data: any) => {
        this.notifications = data;
        this.unreadCount = data.filter((n: any) => !n.isRead).length;
      },
      error: (err) => {
        console.error('Erreur chargement notifications:', err);
      }
    });
  }
  
  loadStudyGroups() {
    this.http.get('http://localhost:3000/api/student/groups').subscribe({
      next: (data: any) => {
        this.studyGroups = data;
      },
      error: (err) => {
        console.error('Erreur chargement groupes:', err);
      }
    });
  }
  
  // Gestion des matières
  addSubject() {
    this.http.post('http://localhost:3000/api/student/subjects', this.newSubject).subscribe({
      next: () => {
        this.loadSubjects();
        this.showSubjectModal = false;
        this.newSubject = { name: '', color: '#4f8ef7', priority: 'medium' };
      },
      error: (err) => console.error(err)
    });
  }
  
  deleteSubject(subjectId: string) {
    if (confirm('Supprimer cette matière ?')) {
      this.http.delete(`http://localhost:3000/api/student/subjects/${subjectId}`).subscribe({
        next: () => this.loadSubjects(),
        error: (err) => console.error(err)
      });
    }
  }
  
  // Génération du planning intelligent
  generateSchedule() {
    this.http.post('http://localhost:3000/api/student/generate-schedule', {
      subjects: this.subjects,
      availabilities: this.availabilities,
      weeklyGoals: this.weeklyGoals
    }).subscribe({
      next: (data: any) => {
        this.generatedSchedule = data;
        this.showScheduleModal = true;
      },
      error: (err) => console.error(err)
    });
  }
  
  acceptSchedule() {
    this.http.post('http://localhost:3000/api/student/accept-schedule', { schedule: this.generatedSchedule }).subscribe({
      next: () => {
        this.showScheduleModal = false;
        this.loadStudySessions();
      },
      error: (err) => console.error(err)
    });
  }
  
  // Gestion des groupes
  createGroup() {
    this.http.post('http://localhost:3000/api/student/groups', this.newGroup).subscribe({
      next: () => {
        this.loadStudyGroups();
        this.showGroupModal = false;
        this.newGroup = { name: '', description: '', isPublic: true, maxMembers: 10 };
      },
      error: (err) => console.error(err)
    });
  }
  
  joinGroup(inviteCode?: string) {
    const code = inviteCode || this.inviteCode;
    if (!code) return;
    
    this.http.post('http://localhost:3000/api/student/groups/join', { inviteCode: code }).subscribe({
      next: () => {
        this.loadStudyGroups();
        this.inviteCode = '';
      },
      error: (err) => console.error(err)
    });
  }
  
  // Rendre une session complétée
  completeSession(sessionId: string) {
    this.http.put(`http://localhost:3000/api/student/sessions/${sessionId}/complete`, {}).subscribe({
      next: () => {
        this.loadStudySessions();
        this.loadStats();
      },
      error: (err) => console.error(err)
    });
  }
  
  // Marquer notification comme lue
  markAsRead(notificationId: string) {
    this.http.put(`http://localhost:3000/api/student/notifications/${notificationId}/read`, {}).subscribe({
      next: () => this.loadNotifications(),
      error: (err) => console.error(err)
    });
  }
  
  logout() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
  
  getPriorityClass(priority: string): string {
    switch(priority) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return '';
    }
  }
  
  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}