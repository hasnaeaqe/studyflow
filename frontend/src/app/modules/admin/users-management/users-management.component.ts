import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './users-management.component.html',
  styleUrls: ['./users-management.component.scss']
})
export class UsersManagementComponent implements OnInit {
  users: any[] = [];
  filteredUsers: any[] = [];
  
  // Recherche
  searchTerm: string = '';
  selectedStatus: string = 'tous';
  selectedRole: string = 'tous';
  
  // Modal
  showUserModal = false;
  isEditingUser = false;
  currentUser: any = {
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'user',
    status: 'active'
  };
  
  isLoading = true;
  
  constructor(private http: HttpClient) {}
  
  ngOnInit() {
    this.loadUsers();
  }
  
  loadUsers() {
    this.http.get('http://localhost:3000/api/admin/users').subscribe({
      next: (data: any) => {
        this.users = data;
        this.filteredUsers = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur:', err);
        this.isLoading = false;
      }
    });
  }
  
  applyFilters() {
    let filtered = [...this.users];
    
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(user => 
        user.firstName.toLowerCase().includes(term) ||
        user.lastName.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
      );
    }
    
    if (this.selectedStatus !== 'tous') {
      filtered = filtered.filter(user => user.status === this.selectedStatus);
    }
    
    if (this.selectedRole !== 'tous') {
      filtered = filtered.filter(user => user.role === this.selectedRole);
    }
    
    this.filteredUsers = filtered;
  }
  
  onSearch() {
    this.applyFilters();
  }
  
  openAddModal() {
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
  
  openEditModal(user: any) {
    this.isEditingUser = true;
    this.currentUser = { ...user };
    this.showUserModal = true;
  }
  
  closeModal() {
    this.showUserModal = false;
  }
  
  saveUser() {
    if (this.isEditingUser) {
      this.http.put(`http://localhost:3000/api/admin/users/${this.currentUser.id}`, this.currentUser).subscribe({
        next: () => {
          this.loadUsers();
          this.closeModal();
        },
        error: (err) => console.error(err)
      });
    } else {
      this.http.post('http://localhost:3000/api/admin/users', this.currentUser).subscribe({
        next: () => {
          this.loadUsers();
          this.closeModal();
        },
        error: (err) => console.error(err)
      });
    }
  }
  
  deleteUser(userId: string, userName: string) {
    if (confirm(`Supprimer ${userName} ?`)) {
      this.http.delete(`http://localhost:3000/api/admin/users/${userId}`).subscribe({
        next: () => {
          this.loadUsers();
        },
        error: (err) => console.error(err)
      });
    }
  }
  
  getStatusClass(status: string): string {
    switch(status) {
      case 'active': return 's-active';
      case 'inactive': return 's-inactive';
      case 'banned': return 's-banned';
      default: return 's-inactive';
    }
  }
  
  getUserInitials(firstName: string, lastName: string): string {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  }
}