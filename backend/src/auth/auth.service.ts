import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notificationService: NotificationService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName, role } = registerDto;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // Créer l'utilisateur avec le rôle (défaut: 'user' si non spécifié)
    const user = await this.prisma.user.create({
      data: {
        email,
        password_hash: hashedPassword,
        firstName,
        lastName,
        role: role === 'admin' ? 'admin' : 'user',
        status: 'active',
        xpPoints: 0,
        level: 1,
        streakDays: 0,
        weeklyGoalHours: 10.0,
        timezone: 'Africa/Casablanca',
        emailVerified: false
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        xpPoints: true,
        level: true
      }
    });

    // 🔔 Notification pour nouvel utilisateur
    await this.notificationService.notifyNewUser(user.id, user.firstName, user.lastName);

     await this.prisma.systemLog.create({
        data: {
          type: 'user_action',
          severity: 'info',
          message: `Nouvel utilisateur inscrit: ${email}`,
          ip: '127.0.0.1' // IP par défaut
        }
      });
      
    // Générer le token JWT
    const payload = { sub: user.id, email: user.email, role: user.role };
    
    return {
      access_token: this.jwtService.sign(payload),
      user
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Chercher l'utilisateur
    const user = await this.prisma.user.findUnique({
      where: { email, deletedAt: null }
    });

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Vérifier le statut
    if (user.status !== 'active') {
      throw new UnauthorizedException('Compte désactivé. Contactez un administrateur.');
    }

    // Générer JWT
    const payload = { sub: user.id, email: user.email, role: user.role };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        xpPoints: user.xpPoints,
        level: user.level
      }
    };
  }

  
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        xpPoints: true,
        level: true,
        streakDays: true,
        weeklyGoalHours: true,
        createdAt: true
      }
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    return user;
  }

  // ← NOUVELLE MÉTHODE
  async updateProfile(userId: string, data: { firstName: string; lastName: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        updatedAt: new Date()
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        xpPoints: true,
        level: true,
        streakDays: true,
        weeklyGoalHours: true,
        createdAt: true
      }
    });
 
    return user;
  }
}