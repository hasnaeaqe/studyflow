import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  user: any = {};
  originalUser: any = {};
  isEditing = false;
  isLoading = true;
  successMessage = '';
  errorMessage = '';

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    this.userService.loadProfile().subscribe({
      next: (data: any) => {
        this.user = data;
        this.originalUser = { ...data };
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur chargement profil:', err);
        this.errorMessage = 'Erreur lors du chargement du profil';
        this.isLoading = false;
      }
    });
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) {
      this.user = { ...this.originalUser };
    }
  }

  saveProfile() {
    this.userService.updateProfile({
      firstName: this.user.firstName,
      lastName: this.user.lastName
    }).subscribe({
      next: (updatedUser: any) => {
        this.successMessage = 'Profil mis à jour avec succès !';
        this.originalUser = { ...updatedUser };
        this.user = { ...updatedUser };
        this.isEditing = false;
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Erreur lors de la mise à jour';
        setTimeout(() => this.errorMessage = '', 3000);
      }
    });
  }
}


// import { Component, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { HttpClient } from '@angular/common/http';
// import { Router } from '@angular/router';

// @Component({
//   selector: 'app-profile',
//   standalone: true,
//   imports: [CommonModule, FormsModule],
//   templateUrl: './profile.component.html',
//   styleUrls: ['./profile.component.scss']
// })
// export class ProfileComponent implements OnInit {
//   user: any = {};
//   originalUser: any = {};
//   isEditing = false;
//   isLoading = true;
//   successMessage = '';
//   errorMessage = '';

//   constructor(private http: HttpClient, private router: Router) {}

//   ngOnInit() {
//     this.loadProfile();
//   }

//   loadProfile() {
//     this.http.get('http://localhost:3000/api/auth/profile').subscribe({
//       next: (data: any) => {
//         this.user = data;
//         this.originalUser = { ...data };
//         this.isLoading = false;
//       },
//       error: (err) => {
//         console.error('Erreur chargement profil:', err);
//         this.isLoading = false;
//       }
//     });
//   }

//   toggleEdit() {
//     this.isEditing = !this.isEditing;
//     if (!this.isEditing) {
//       this.user = { ...this.originalUser };
//     }
//   }

//   saveProfile() {
//     this.http.put('http://localhost:3000/api/auth/profile', this.user).subscribe({
//       next: (data: any) => {
//         this.successMessage = 'Profil mis à jour avec succès !';
//         this.originalUser = { ...this.user };
//         this.isEditing = false;
//         setTimeout(() => this.successMessage = '', 3000);
        
//         // Mettre à jour localStorage
//         const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
//         storedUser.firstName = this.user.firstName;
//         storedUser.lastName = this.user.lastName;
//         localStorage.setItem('user', JSON.stringify(storedUser));
//       },
//       error: (err) => {
//         this.errorMessage = err.error?.message || 'Erreur lors de la mise à jour';
//         setTimeout(() => this.errorMessage = '', 3000);
//       }
//     });
//   }

//   changePassword(oldPassword: string, newPassword: string) {
//     this.http.post('http://localhost:3000/api/auth/change-password', {
//       oldPassword, newPassword
//     }).subscribe({
//       next: () => {
//         this.successMessage = 'Mot de passe modifié avec succès !';
//         setTimeout(() => this.successMessage = '', 3000);
//       },
//       error: (err) => {
//         this.errorMessage = err.error?.message || 'Erreur lors du changement de mot de passe';
//       }
//     });
//   }
// }