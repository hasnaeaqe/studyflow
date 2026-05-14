import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  registerData = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user',  // ← BIEN PRÉSENT
    acceptTerms: false
  };
  
  errorMessage = '';
  successMessage = '';
  isLoading = false;
  
  constructor(
    private router: Router,
    private http: HttpClient
  ) {}
  
  onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';
    
    // Validation
    if (this.registerData.password !== this.registerData.confirmPassword) {
      this.errorMessage = 'Les mots de passe ne correspondent pas';
      return;
    }
    
    if (this.registerData.password.length < 6) {
      this.errorMessage = 'Le mot de passe doit contenir au moins 6 caractères';
      return;
    }
    
    if (!this.registerData.acceptTerms) {
      this.errorMessage = 'Vous devez accepter les conditions d\'utilisation';
      return;
    }
    
    this.isLoading = true;
    
    // Afficher les données envoyées pour déboguer
    console.log('📤 Envoi inscription:', {
      email: this.registerData.email,
      password: this.registerData.password,
      firstName: this.registerData.firstName,
      lastName: this.registerData.lastName,
      role: this.registerData.role
    });
    
    // Appel API avec le rôle
    this.http.post('http://localhost:3000/api/auth/register', {
      email: this.registerData.email,
      password: this.registerData.password,
      firstName: this.registerData.firstName,
      lastName: this.registerData.lastName,
      role: this.registerData.role  // ← IMPORTANT: envoie le rôle
    }).subscribe({
      next: (response: any) => {
        console.log('✅ Réponse inscription:', response);
        this.isLoading = false;
        this.successMessage = 'Inscription réussie ! Redirection vers la connexion...';
        
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (error) => {
        console.error('❌ Erreur inscription:', error);
        this.isLoading = false;
        this.errorMessage = error.error?.message || 'Erreur lors de l\'inscription. Vérifiez vos informations.';
      }
    });
  }
}