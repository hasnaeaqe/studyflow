import { IsEmail, IsString, MinLength, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsString()
  @IsIn(['user', 'admin'], { message: 'Le rôle doit être user ou admin' })
  role?: string;  // Optionnel, par défaut 'user'
}