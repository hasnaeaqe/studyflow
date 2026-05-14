import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-groups-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './groups-management.component.html',
  styleUrls: ['./groups-management.component.scss']
})
export class GroupsManagementComponent implements OnInit {
  groups: any[] = [];
  filteredGroups: any[] = [];
  
  searchTerm: string = '';
  selectedType: string = 'tous';
  
  showGroupModal = false;
  currentGroup: any = {};
  isLoading = true;
  
  stats = {
    total: 0,
    public: 0,
    private: 0,
    totalMembers: 0
  };
  
  constructor(private http: HttpClient) {}
  
  ngOnInit() {
    this.loadGroups();
    this.loadStats();
  }
  
  loadGroups() {
    this.http.get('http://localhost:3000/api/admin/groups').subscribe({
      next: (data: any) => {
        this.groups = data;
        this.filteredGroups = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur chargement groupes:', err);
        this.isLoading = false;
      }
    });
  }
  
  loadStats() {
    this.http.get('http://localhost:3000/api/admin/groups-stats').subscribe({
      next: (data: any) => {
        this.stats = data;
      },
      error: (err) => {
        console.error('Erreur chargement stats:', err);
      }
    });
  }
  
  applyFilters() {
    let filtered = [...this.groups];
    
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(group => 
        group.name.toLowerCase().includes(term) ||
        (group.description && group.description.toLowerCase().includes(term)) ||
        group.owner.toLowerCase().includes(term)
      );
    }
    
    if (this.selectedType !== 'tous') {
      const isPublic = this.selectedType === 'public';
      filtered = filtered.filter(group => group.isPublic === isPublic);
    }
    
    this.filteredGroups = filtered;
  }
  
  onSearch() {
    this.applyFilters();
  }
  
  onTypeChange() {
    this.applyFilters();
  }
  
  getTotalGroups(): number {
    return this.stats.total;
  }
  
  getPublicGroups(): number {
    return this.stats.public;
  }
  
  getPrivateGroups(): number {
    return this.stats.private;
  }
  
  getTotalMembers(): number {
    return this.stats.totalMembers;
  }
  
  getUserInitials(fullName: string): string {
    const parts = fullName.split(' ');
    return (parts[0]?.charAt(0) || '') + (parts[1]?.charAt(0) || '');
  }
  
  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  
  openGroupDetails(group: any) {
    this.http.get(`http://localhost:3000/api/admin/groups/${group.id}`).subscribe({
      next: (data: any) => {
        this.currentGroup = data;
        this.showGroupModal = true;
      },
      error: (err) => console.error(err)
    });
  }
  
  closeModal() {
    this.showGroupModal = false;
    this.currentGroup = {};
  }
  
  getOccupancyRate(memberCount: number, maxMembers: number): number {
    return Math.round((memberCount / maxMembers) * 100);
  }
}