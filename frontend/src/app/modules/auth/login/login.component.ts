import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';  // ← À AJOUTER

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginData = {
    email: '',
    password: '',
    rememberMe: false
  };
  
  errorMessage = '';
  isLoading = false;
  
  // ← MODIFIER le constructeur
  constructor(
    private router: Router,
    private http: HttpClient  // ← AJOUTER cette ligne
  ) {}
  
  onSubmit() {
    this.isLoading = true;
    this.errorMessage = '';
    
    // ← REMPLACER toute la simulation par cet appel API
    this.http.post('http://localhost:3000/api/auth/login', {
      email: this.loginData.email,
      password: this.loginData.password
    }).subscribe({
      next: (response: any) => {
        // Sauvegarde du token et des infos utilisateur
        localStorage.setItem('token', response.access_token);
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('userRole', response.user.role);
        localStorage.setItem('userName', response.user.firstName);
        
        this.isLoading = false;
        
        // Redirection selon le rôle
        if (response.user.role === 'admin') {
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.message || 'Erreur de connexion. Vérifiez vos identifiants.';
        console.error('Erreur de connexion:', error);
      }
    });
  }
}