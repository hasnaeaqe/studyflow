// backend/src/admin/admin.controller.ts
import { Controller, Get, UseGuards, Query, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Post, Put, Delete, Body, Param, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Request } from 'express';  // ← CHANGÉ: import type
import { LogsService } from '../logs/logs.service';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private prisma: PrismaService,
    private logsService: LogsService
  ) {}

  @Get('dashboard')
  async getDashboard() {
    // Statistiques globales
    const totalUsers = await this.prisma.user.count({ where: { deletedAt: null } });
    const activeUsers = await this.prisma.user.count({ where: { status: 'active', deletedAt: null } });
    const bannedUsers = await this.prisma.user.count({ where: { status: 'banned' } });
    const totalSessions = await this.prisma.studySession.count({ where: { deletedAt: null } });
    const completedSessions = await this.prisma.studySession.count({ where: { status: 'completed' } });
    
    // Heures totales d'étude - calcul via SQL avec les dates
    const sessions = await this.prisma.studySession.findMany({
      where: { status: 'completed', deletedAt: null },
      select: { plannedStart: true, plannedEnd: true, actualStart: true, actualEnd: true }
    });
    
    let totalMinutes = 0;
    for (const session of sessions) {
      const start = session.actualStart || session.plannedStart;
      const end = session.actualEnd || session.plannedEnd;
      if (start && end) {
        const duration = (end.getTime() - start.getTime()) / (1000 * 60);
        totalMinutes += duration;
      }
    }
    const totalHoursStudied = Math.round(totalMinutes / 60);
    
    // Nouveaux utilisateurs (7 derniers jours)
    const newUsersLast7d = await this.prisma.user.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
    });
    
    // Sessions 7 derniers jours
    const sessionsLast7d = await this.prisma.studySession.count({
      where: { plannedStart: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
    });

    // Groupes actifs
    const activeGroups = await this.prisma.studyGroup.count({ where: { isActive: true } });
    
    // Total des membres dans les groupes
    const totalMemberships = await this.prisma.groupMember.count({ where: { isActive: true } });

    return {
      kpis: {
        totalUsers,
        activeUsers,
        bannedUsers,
        totalSessions,
        completedSessions,
        totalHoursStudied,
        activeGroups,
        totalMemberships,
        newUsersLast7d,
        sessionsLast7d
      }
    };
  }

  @Get('users')
  async getUsers() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        xpPoints: true,
        level: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Récupérer les stats de sessions pour chaque utilisateur
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const sessions = await this.prisma.studySession.findMany({
        where: { userId: user.id, status: 'completed', deletedAt: null },
        select: { plannedStart: true, plannedEnd: true, actualStart: true, actualEnd: true }
      });
      
      let totalMinutes = 0;
      for (const session of sessions) {
        const start = session.actualStart || session.plannedStart;
        const end = session.actualEnd || session.plannedEnd;
        if (start && end) {
          const duration = (end.getTime() - start.getTime()) / (1000 * 60);
          totalMinutes += duration;
        }
      }
      
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        xpPoints: user.xpPoints,
        level: user.level,
        sessions: sessions.length,
        hours: Math.round(totalMinutes / 60),
        registeredAt: user.createdAt
      };
    }));

    return usersWithStats;
  }

  @Get('activity')
  async getActivity() {
    // Récupérer les activités récentes depuis la base
    const recentSessions = await this.prisma.studySession.findMany({
      where: { status: 'completed', deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: {
        user: { select: { firstName: true, lastName: true } }
      }
    });

    const recentUsers = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { firstName: true, lastName: true, email: true }
    });

    const activities = [
      ...recentSessions.map(s => ({
        user: `${s.user.firstName} ${s.user.lastName}`,
        action: `a complété la session "${s.title}"`,
        time: `${Math.floor((Date.now() - s.updatedAt.getTime()) / 60000)} min`
      })),
      ...recentUsers.map(u => ({
        user: `${u.firstName} ${u.lastName}`,
        action: `a rejoint StudyFlow`,
        time: "récemment"
      }))
    ];

    return activities.slice(0, 5);
  }

  // ============================================
  // GESTION DES UTILISATEURS AVEC LOGS
  // ============================================

  @Post('users')
  async createUser(@Body() createUserDto: any, @Req() req: Request) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email }
    });
    
    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }
    
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password_hash: hashedPassword,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        role: createUserDto.role || 'user',
        status: createUserDto.status || 'active',
        xpPoints: 0,
        level: 1,
        streakDays: 0,
        weeklyGoalHours: 10,
        timezone: 'Africa/Casablanca',
        emailVerified: false
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true
      }
    });
    
    const adminId = (req as any).user?.id;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    await this.logsService.createSystemLog(
      'user_action',
      'info',
      `Utilisateur créé par admin: ${user.email}`,
      adminId,
      ip
    );
    
    return user;
  }

  @Put('users/:id')
  async updateUser(@Param('id') id: string, @Body() updateUserDto: any, @Req() req: Request) {
    const oldUser = await this.prisma.user.findUnique({ where: { id } });
    if (!oldUser) {
      throw new Error('Utilisateur non trouvé');
    }
    
    const { password, ...data } = updateUserDto;
    
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        status: data.status
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true
      }
    });
    
    const adminId = (req as any).user?.id;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    await this.logsService.createSystemLog(
      'user_action',
      'info',
      `Utilisateur modifié par admin: ${user.email}`,
      adminId,
      ip
    );
    
    return user;
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string, @Req() req: Request) {
    const userToDelete = await this.prisma.user.findUnique({ where: { id } });
    if (!userToDelete) {
      throw new Error('Utilisateur non trouvé');
    }
    
    const user = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    
    const adminId = (req as any).user?.id;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    await this.logsService.createSystemLog(
      'user_action',
      'warning',
      `Utilisateur supprimé par admin: ${userToDelete.email}`,
      adminId,
      ip
    );
    
    return { message: 'Utilisateur supprimé avec succès', id: user.id };
  }

  // ============================================
  // GESTION DES SESSIONS AVEC LOGS
  // ============================================

  @Get('sessions')
  async getAllSessions(@Query('status') status?: string, @Query('priority') priority?: string) {
    const where: any = { deletedAt: null };
    
    if (status && status !== 'tous') {
      where.status = status;
    }
    
    if (priority && priority !== 'tous') {
      where.priority = priority;
    }
    
    const sessions = await this.prisma.studySession.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        subject: {
          select: {
            name: true,
            color: true
          }
        }
      },
      orderBy: { plannedStart: 'desc' }
    });
    console.log('📊 Nombre de sessions en base:', sessions.length);
    return sessions.map(session => ({
      id: session.id,
      title: session.title,
      subject: session.subject?.name || 'Sans matière',
      subjectColor: session.subject?.color || '#4f8ef7',
      user: `${session.user.firstName} ${session.user.lastName}`,
      userEmail: session.user.email,
      plannedStart: session.plannedStart,
      plannedEnd: session.plannedEnd,
      duration: Math.round((session.plannedEnd.getTime() - session.plannedStart.getTime()) / (1000 * 60)),
      priority: session.priority,
      status: session.status,
      createdAt: session.createdAt
    }));
  }

  @Get('sessions/:id')
  async getSessionById(@Param('id') id: string) {
    const session = await this.prisma.studySession.findUnique({
      where: { id, deletedAt: null },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        subject: {
          select: {
            name: true,
            color: true
          }
        }
      }
    });

    if (!session) {
      throw new Error('Session non trouvée');
    }

    return {
      id: session.id,
      title: session.title,
      description: session.description,
      subject: session.subject?.name || 'Sans matière',
      subjectColor: session.subject?.color || '#4f8ef7',
      user: `${session.user.firstName} ${session.user.lastName}`,
      userEmail: session.user.email,
      plannedStart: session.plannedStart,
      plannedEnd: session.plannedEnd,
      actualStart: session.actualStart,
      actualEnd: session.actualEnd,
      duration: Math.round((session.plannedEnd.getTime() - session.plannedStart.getTime()) / (1000 * 60)),
      priority: session.priority,
      status: session.status,
      notes: session.notes,
      createdAt: session.createdAt
    };
  }

  @Put('sessions/:id/status')
  async updateSessionStatus(@Param('id') id: string, @Body() body: { status: string }, @Req() req: Request) {
    const oldSession = await this.prisma.studySession.findUnique({ where: { id } });
    if (!oldSession) {
      throw new Error('Session non trouvée');
    }
    
    const session = await this.prisma.studySession.update({
      where: { id },
      data: { 
        status: body.status as any,
        updatedAt: new Date()
      }
    });
    
    const adminId = (req as any).user?.id;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    
    if (body.status === 'cancelled') {
      await this.logsService.createSystemLog(
        'session',
        'warning',
        `Session annulée: "${oldSession.title}"`,
        adminId,
        ip
      );
    } else if (body.status === 'completed') {
      await this.logsService.createSystemLog(
        'session',
        'info',
        `Session terminée: "${oldSession.title}"`,
        adminId,
        ip
      );
    } else {
      await this.logsService.createSystemLog(
        'session',
        'info',
        `Statut session modifié: "${oldSession.title}" → ${body.status}`,
        adminId,
        ip
      );
    }
    
    return session;
  }

  @Put('sessions/:id/priority')
  async updateSessionPriority(@Param('id') id: string, @Body() body: { priority: string }, @Req() req: Request) {
    const oldSession = await this.prisma.studySession.findUnique({ where: { id } });
    if (!oldSession) {
      throw new Error('Session non trouvée');
    }
    
    const session = await this.prisma.studySession.update({
      where: { id },
      data: { 
        priority: body.priority as any,
        updatedAt: new Date()
      }
    });
    
    const adminId = (req as any).user?.id;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    await this.logsService.createSystemLog(
      'session',
      'info',
      `Priorité session modifiée: "${oldSession.title}" → ${body.priority}`,
      adminId,
      ip
    );
    
    return session;
  }

  @Put('sessions/:id')
  async updateSession(@Param('id') id: string, @Body() updateData: any, @Req() req: Request) {
    const oldSession = await this.prisma.studySession.findUnique({ where: { id } });
    if (!oldSession) {
      throw new Error('Session non trouvée');
    }
    
    const session = await this.prisma.studySession.update({
      where: { id },
      data: {
        title: updateData.title,
        description: updateData.description,
        priority: updateData.priority as any,
        status: updateData.status as any,
        plannedStart: updateData.plannedStart ? new Date(updateData.plannedStart) : undefined,
        plannedEnd: updateData.plannedEnd ? new Date(updateData.plannedEnd) : undefined,
        updatedAt: new Date()
      }
    });
    
    const adminId = (req as any).user?.id;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    await this.logsService.createSystemLog(
      'session',
      'info',
      `Session modifiée: "${session.title}"`,
      adminId,
      ip
    );
    
    return session;
  }

  @Delete('sessions/:id')
  async deleteSession(@Param('id') id: string, @Req() req: Request) {
    const sessionToDelete = await this.prisma.studySession.findUnique({ where: { id } });
    if (!sessionToDelete) {
      throw new Error('Session non trouvée');
    }
    
    const session = await this.prisma.studySession.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    
    const adminId = (req as any).user?.id;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    await this.logsService.createSystemLog(
      'session',
      'warning',
      `Session supprimée: "${sessionToDelete.title}"`,
      adminId,
      ip
    );
    
    return { message: 'Session supprimée avec succès', id: session.id };
  }

  @Get('sessions-stats')
  async getSessionsStats() {
    const total = await this.prisma.studySession.count({ where: { deletedAt: null } });
    const completed = await this.prisma.studySession.count({ where: { status: 'completed', deletedAt: null } });
    const inProgress = await this.prisma.studySession.count({ where: { status: 'in_progress', deletedAt: null } });
    const planned = await this.prisma.studySession.count({ where: { status: 'planned', deletedAt: null } });
    const cancelled = await this.prisma.studySession.count({ where: { status: 'cancelled', deletedAt: null } });
    const missed = await this.prisma.studySession.count({ where: { status: 'missed', deletedAt: null } });

    const bySubject = await this.prisma.studySession.groupBy({
      by: ['subjectId'],
      where: { deletedAt: null },
      _count: { subjectId: true }
    });

    return {
      total,
      completed,
      inProgress,
      planned,
      cancelled,
      missed,
      bySubject
    };
  }

  // ============================================
  // GESTION DES GROUPES AVEC LOGS
  // ============================================

  @Get('groups')
  async getAllGroups() {
    const groups = await this.prisma.studyGroup.findMany({
      where: { isActive: true },
      include: {
        creator: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        members: {
          where: { isActive: true },
          select: {
            userId: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return groups.map(group => ({
      id: group.id,
      name: group.name,
      description: group.description,
      owner: `${group.creator.firstName} ${group.creator.lastName}`,
      ownerEmail: group.creator.email,
      memberCount: group.members.length,
      maxMembers: group.maxMembers,
      isPublic: group.isPublic,
      createdAt: group.createdAt,
      subject: null
    }));
  }

  @Get('groups/:id')
  async getGroupById(@Param('id') id: string) {
    const group = await this.prisma.studyGroup.findUnique({
      where: { id, isActive: true },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        members: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!group) {
      throw new Error('Groupe non trouvé');
    }

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      owner: `${group.creator.firstName} ${group.creator.lastName}`,
      ownerEmail: group.creator.email,
      memberCount: group.members.length,
      maxMembers: group.maxMembers,
      isPublic: group.isPublic,
      invitationCode: group.invitationCode,
      createdAt: group.createdAt,
      members: group.members.map(m => ({
        id: m.user.id,
        name: `${m.user.firstName} ${m.user.lastName}`,
        email: m.user.email,
        role: m.role
      }))
    };
  }

  @Post('groups')
  async createGroup(@Body() body: any, @Req() req: Request) {
    const group = await this.prisma.studyGroup.create({
      data: {
        name: body.name,
        description: body.description,
        createdBy: body.createdBy,
        isPublic: body.isPublic ?? true,
        maxMembers: body.maxMembers ?? 20,
        isActive: true
      }
    });

    await this.prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: body.createdBy,
        role: 'owner',
        isActive: true
      }
    });
    
    const adminId = (req as any).user?.id;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    await this.logsService.createSystemLog(
      'group',
      'info',
      `Groupe créé: "${group.name}"`,
      adminId,
      ip
    );

    return group;
  }

  @Put('groups/:id')
  async updateGroup(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
    const oldGroup = await this.prisma.studyGroup.findUnique({ where: { id } });
    if (!oldGroup) {
      throw new Error('Groupe non trouvé');
    }
    
    const group = await this.prisma.studyGroup.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        isPublic: body.isPublic,
        maxMembers: body.maxMembers,
        updatedAt: new Date()
      }
    });
    
    const adminId = (req as any).user?.id;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    await this.logsService.createSystemLog(
      'group',
      'info',
      `Groupe modifié: "${group.name}"`,
      adminId,
      ip
    );
    
    return group;
  }

  @Delete('groups/:id')
  async deleteGroup(@Param('id') id: string, @Req() req: Request) {
    const groupToDelete = await this.prisma.studyGroup.findUnique({ where: { id } });
    if (!groupToDelete) {
      throw new Error('Groupe non trouvé');
    }
    
    const group = await this.prisma.studyGroup.update({
      where: { id },
      data: { isActive: false }
    });
    
    const adminId = (req as any).user?.id;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    await this.logsService.createSystemLog(
      'group',
      'warning',
      `Groupe supprimé: "${groupToDelete.name}"`,
      adminId,
      ip
    );
    
    return { message: 'Groupe supprimé avec succès', id: group.id };
  }

  @Get('groups-stats')
  async getGroupsStats() {
    const total = await this.prisma.studyGroup.count({ where: { isActive: true } });
    const publicGroups = await this.prisma.studyGroup.count({ where: { isActive: true, isPublic: true } });
    const privateGroups = await this.prisma.studyGroup.count({ where: { isActive: true, isPublic: false } });
    
    const members = await this.prisma.groupMember.findMany({
      where: { isActive: true },
      select: { userId: true }
    });
    const totalMembers = members.length;

    return {
      total,
      public: publicGroups,
      private: privateGroups,
      totalMembers
    };
  }

  @Get('groups/:id/members')
  async getGroupMembers(@Param('id') id: string) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId: id, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            xpPoints: true,
            level: true
          }
        }
      }
    });

    return members.map(m => ({
      id: m.user.id,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      email: m.user.email,
      role: m.role,
      xpPoints: m.user.xpPoints,
      level: m.user.level
    }));
  }

  @Post('groups/:id/members')
  async addMember(@Param('id') id: string, @Body() body: { userId: string; role?: string }, @Req() req: Request) {
    const group = await this.prisma.studyGroup.findUnique({ where: { id } });
    if (!group) {
      throw new Error('Groupe non trouvé');
    }
    
    const user = await this.prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }
    
    const member = await this.prisma.groupMember.create({
      data: {
        groupId: id,
        userId: body.userId,
        role: (body.role as any) ?? 'member',
        isActive: true
      }
    });
    
    const adminId = (req as any).user?.id;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    await this.logsService.createSystemLog(
      'group',
      'info',
      `Membre ajouté au groupe "${group.name}": ${user.firstName} ${user.lastName}`,
      adminId,
      ip
    );
    
    return member;
  }

  @Delete('groups/:groupId/members/:userId')
  async removeMember(@Param('groupId') groupId: string, @Param('userId') userId: string, @Req() req: Request) {
    const group = await this.prisma.studyGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new Error('Groupe non trouvé');
    }
    
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }
    
    const member = await this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { isActive: false }
    });
    
    const adminId = (req as any).user?.id;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    await this.logsService.createSystemLog(
      'group',
      'info',
      `Membre retiré du groupe "${group.name}": ${user.firstName} ${user.lastName}`,
      adminId,
      ip
    );
    
    return { message: 'Membre retiré avec succès' };
  }

  // ============================================
  // PRODUCTIVITÉ - ENDPOINTS
  // ============================================

  @Get('productivity')
  async getProductivityStats() {
    const totalUsers = await this.prisma.user.count({ where: { deletedAt: null, status: 'active' } });
    
    const allSessions = await this.prisma.studySession.findMany({
      where: { deletedAt: null },
      select: { status: true, plannedStart: true, plannedEnd: true, actualStart: true, actualEnd: true }
    });
    
    const totalSessions = allSessions.length;
    const completedSessions = allSessions.filter(s => s.status === 'completed').length;
    const avgCompletionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
    
    let totalMinutes = 0;
    for (const session of allSessions) {
      const start = session.actualStart || session.plannedStart;
      const end = session.actualEnd || session.plannedEnd;
      if (start && end) {
        const duration = (end.getTime() - start.getTime()) / (1000 * 60);
        totalMinutes += duration;
      }
    }
    const totalHours = Math.round(totalMinutes / 60);
    
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, status: 'active' },
      select: { streakDays: true }
    });
    const avgStreak = users.length > 0 ? Math.round(users.reduce((acc, u) => acc + u.streakDays, 0) / users.length) : 0;
    
    const globalStats = {
      avgCompletionRate,
      totalHours,
      totalSessions,
      activeUsers: totalUsers,
      avgStreak
    };
    
    const usersWithStats = await this.prisma.user.findMany({
      where: { deletedAt: null, status: 'active' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        xpPoints: true,
        streakDays: true
      },
      take: 10
    });
    
    const topUsers = await Promise.all(usersWithStats.map(async (user) => {
      const sessions = await this.prisma.studySession.findMany({
        where: { userId: user.id, deletedAt: null },
        select: { status: true, plannedStart: true, plannedEnd: true, actualStart: true, actualEnd: true }
      });
      
      let totalMinutes = 0;
      let completedCount = 0;
      for (const session of sessions) {
        const start = session.actualStart || session.plannedStart;
        const end = session.actualEnd || session.plannedEnd;
        if (start && end) {
          const duration = (end.getTime() - start.getTime()) / (1000 * 60);
          totalMinutes += duration;
        }
        if (session.status === 'completed') completedCount++;
      }
      
      const completionRate = sessions.length > 0 ? Math.round((completedCount / sessions.length) * 100) : 0;
      
      return {
        name: `${user.firstName} ${user.lastName}`,
        hours: Math.round(totalMinutes / 60),
        sessions: sessions.length,
        completionRate,
        xp: user.xpPoints,
        streak: user.streakDays
      };
    }));
    
    const sortedTopUsers = topUsers.sort((a, b) => b.hours - a.hours).slice(0, 5);
    
    const subjects = await this.prisma.subject.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        color: true
      }
    });
    
    const subjectProductivity = await Promise.all(subjects.map(async (subject) => {
      const sessions = await this.prisma.studySession.findMany({
        where: { subjectId: subject.id, deletedAt: null },
        select: { status: true, plannedStart: true, plannedEnd: true, actualStart: true, actualEnd: true }
      });
      
      let totalMinutes = 0;
      let completedCount = 0;
      for (const session of sessions) {
        const start = session.actualStart || session.plannedStart;
        const end = session.actualEnd || session.plannedEnd;
        if (start && end) {
          const duration = (end.getTime() - start.getTime()) / (1000 * 60);
          totalMinutes += duration;
        }
        if (session.status === 'completed') completedCount++;
      }
      
      const completionRate = sessions.length > 0 ? Math.round((completedCount / sessions.length) * 100) : 0;
      
      return {
        name: subject.name,
        color: subject.color,
        hours: Math.round(totalMinutes / 60),
        sessions: sessions.length,
        completionRate
      };
    }));
    
    const sortedSubjects = subjectProductivity.sort((a, b) => b.hours - a.hours);
    const weeklyActivity = await this.getWeeklyActivity();
    
    return {
      globalStats,
      topUsers: sortedTopUsers,
      subjectProductivity: sortedSubjects,
      weeklyActivity
    };
  }

  private async getWeeklyActivity() {
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const result: any[] = [];
    
    const now = new Date();
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(now.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(startOfWeek);
      currentDay.setDate(startOfWeek.getDate() + i);
      const nextDay = new Date(currentDay);
      nextDay.setDate(currentDay.getDate() + 1);
      
      const sessions = await this.prisma.studySession.count({
        where: {
          deletedAt: null,
          plannedStart: {
            gte: currentDay,
            lt: nextDay
          }
        }
      });
      
      result.push({
        day: days[i],
        sessions,
        hours: sessions * 1.5
      });
    }
    
    return result;
  }

  @Get('productivity/user/:userId')
  async getUserProductivity(@Param('userId') userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        xpPoints: true,
        level: true,
        streakDays: true
      }
    });
    
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }
    
    const sessions = await this.prisma.studySession.findMany({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        plannedStart: true,
        plannedEnd: true,
        actualStart: true,
        actualEnd: true,
        subject: { select: { name: true, color: true } }
      },
      orderBy: { plannedStart: 'desc' }
    });
    
    let totalMinutes = 0;
    let completedCount = 0;
    for (const session of sessions) {
      const start = session.actualStart || session.plannedStart;
      const end = session.actualEnd || session.plannedEnd;
      if (start && end) {
        const duration = (end.getTime() - start.getTime()) / (1000 * 60);
        totalMinutes += duration;
      }
      if (session.status === 'completed') completedCount++;
    }
    
    const totalHours = Math.round(totalMinutes / 60);
    const completionRate = sessions.length > 0 ? Math.round((completedCount / sessions.length) * 100) : 0;
    const sessionsByDay = await this.getUserSessionsByDay(userId);
    
    const recentSessions = sessions.slice(0, 10).map(s => ({
      id: s.id,
      title: s.title,
      status: s.status,
      priority: s.priority,
      date: s.plannedStart,
      subject: s.subject?.name || 'Sans matière'
    }));
    
    return {
      user: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        xpPoints: user.xpPoints,
        level: user.level,
        streakDays: user.streakDays
      },
      stats: {
        totalHours,
        totalSessions: sessions.length,
        completedSessions: completedCount,
        completionRate
      },
      sessionsByDay,
      recentSessions
    };
  }

  private async getUserSessionsByDay(userId: string) {
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const result: any[] = [];
    
    const now = new Date();
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(now.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(startOfWeek);
      currentDay.setDate(startOfWeek.getDate() + i);
      const nextDay = new Date(currentDay);
      nextDay.setDate(currentDay.getDate() + 1);
      
      const sessions = await this.prisma.studySession.count({
        where: {
          userId,
          deletedAt: null,
          plannedStart: {
            gte: currentDay,
            lt: nextDay
          }
        }
      });
      
      result.push({
        day: days[i],
        sessions,
        hours: sessions * 1.5
      });
    }
    
    return result;
  }

  // ============================================
  // NOTIFICATIONS - ENDPOINTS
  // ============================================

  @Get('notifications')
  async getAllNotifications() {
    const notifications = await this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    return notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      createdAt: n.createdAt,
      userId: n.userId,
      userName: n.user ? `${n.user.firstName} ${n.user.lastName}` : null,
      data: n.data
    }));
  }

  @Get('notifications/unread-count')
  async getUnreadCount() {
    const count = await this.prisma.notification.count({
      where: { isRead: false }
    });
    return { count };
  }

  @Put('notifications/:id/read')
  async markAsRead(@Param('id') id: string) {
    const notification = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });
    return notification;
  }

  @Put('notifications/mark-all-read')
  async markAllAsRead() {
    await this.prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true }
    });
    return { message: 'Toutes les notifications ont été marquées comme lues' };
  }

  @Delete('notifications/:id')
  async deleteNotification(@Param('id') id: string) {
    await this.prisma.notification.delete({ where: { id } });
    return { message: 'Notification supprimée' };
  }

  @Delete('notifications')
  async deleteMultipleNotifications(@Body() body: { ids: string[] }) {
    await this.prisma.notification.deleteMany({
      where: { id: { in: body.ids } }
    });
    return { message: `${body.ids.length} notifications supprimées` };
  }

  // ============================================
  // SYSTÈME LOGS - ENDPOINTS
  // ============================================

  @Get('system-logs')
  async getSystemLogs(@Query('type') type?: string, @Query('severity') severity?: string) {
    const where: any = {};
    
    if (type && type !== 'tous') {
      where.type = type;
    }
    
    if (severity && severity !== 'tous') {
      where.severity = severity;
    }
    
    const logs = await this.prisma.systemLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500
    });
    
    return logs;
  }
  // backend/src/admin/admin.controller.ts

// Ajoutez cette méthode après les autres endpoints
@Get('subjects-progress')
async getSubjectsProgress() {
  // Récupérer toutes les matières avec leurs sessions
  const subjects = await this.prisma.subject.findMany({
    where: { isActive: true },
    include: {
      studySessions: {
        where: { deletedAt: null },
        select: { status: true, plannedStart: true, plannedEnd: true, actualStart: true, actualEnd: true }
      }
    }
  });

  // Calculer le total des heures pour toutes les matières
  let totalMinutes = 0;
  const subjectsWithMinutes = subjects.map(subject => {
    let subjectMinutes = 0;
    for (const session of subject.studySessions) {
      const start = session.actualStart || session.plannedStart;
      const end = session.actualEnd || session.plannedEnd;
      if (start && end && session.status === 'completed') {
        const duration = (end.getTime() - start.getTime()) / (1000 * 60);
        subjectMinutes += duration;
        totalMinutes += duration;
      }
    }
    return {
      name: subject.name,
      color: subject.color,
      minutes: subjectMinutes
    };
  });

  // Calculer les pourcentages
  const subjectsProgress = subjectsWithMinutes.map(subject => ({
    name: subject.name,
    color: subject.color,
    percentage: totalMinutes > 0 ? Math.round((subject.minutes / totalMinutes) * 100) : 0
  }));

  // Si pas de données, retourner des exemples
  if (subjectsProgress.length === 0) {
    return [
      { name: 'Mathématiques', color: 'var(--accent)', percentage: 42 },
      { name: 'Informatique', color: 'var(--green)', percentage: 28 },
      { name: 'Physique', color: 'var(--amber)', percentage: 15 },
      { name: 'Autres', color: 'var(--dark-5)', percentage: 15 }
    ];
  }

  return subjectsProgress;
}
}


// // backend/src/admin/admin.controller.ts
// import { Controller, Get, UseGuards, Query } from '@nestjs/common';
// import { PrismaService } from '../prisma/prisma.service';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { Post, Put, Delete, Body, Param, ConflictException } from '@nestjs/common';
// import * as bcrypt from 'bcrypt';

// @Controller('admin')
// @UseGuards(JwtAuthGuard)
// export class AdminController {
//   constructor(private prisma: PrismaService) {}

//   @Get('dashboard')
//   async getDashboard() {
//     // Statistiques globales
//     const totalUsers = await this.prisma.user.count({ where: { deletedAt: null } });
//     const activeUsers = await this.prisma.user.count({ where: { status: 'active', deletedAt: null } });
//     const bannedUsers = await this.prisma.user.count({ where: { status: 'banned' } });
//     const totalSessions = await this.prisma.studySession.count({ where: { deletedAt: null } });
//     const completedSessions = await this.prisma.studySession.count({ where: { status: 'completed' } });
    
//     // Heures totales d'étude - calcul via SQL avec les dates
//     const sessions = await this.prisma.studySession.findMany({
//       where: { status: 'completed', deletedAt: null },
//       select: { plannedStart: true, plannedEnd: true, actualStart: true, actualEnd: true }
//     });
    
//     let totalMinutes = 0;
//     for (const session of sessions) {
//       const start = session.actualStart || session.plannedStart;
//       const end = session.actualEnd || session.plannedEnd;
//       if (start && end) {
//         const duration = (end.getTime() - start.getTime()) / (1000 * 60);
//         totalMinutes += duration;
//       }
//     }
//     const totalHoursStudied = Math.round(totalMinutes / 60);
    
//     // Nouveaux utilisateurs (7 derniers jours)
//     const newUsersLast7d = await this.prisma.user.count({
//       where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
//     });
    
//     // Sessions 7 derniers jours
//     const sessionsLast7d = await this.prisma.studySession.count({
//       where: { plannedStart: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
//     });

//     // Groupes actifs
//     const activeGroups = await this.prisma.studyGroup.count({ where: { isActive: true } });
    
//     // Total des membres dans les groupes
//     const totalMemberships = await this.prisma.groupMember.count({ where: { isActive: true } });

//     return {
//       kpis: {
//         totalUsers,
//         activeUsers,
//         bannedUsers,
//         totalSessions,
//         completedSessions,
//         totalHoursStudied,
//         activeGroups,
//         totalMemberships,
//         newUsersLast7d,
//         sessionsLast7d
//       }
//     };
//   }

//   @Get('users')
//   async getUsers() {
//     const users = await this.prisma.user.findMany({
//       where: { deletedAt: null },
//       select: {
//         id: true,
//         email: true,
//         firstName: true,
//         lastName: true,
//         role: true,
//         status: true,
//         xpPoints: true,
//         level: true,
//         createdAt: true,
//       },
//       orderBy: { createdAt: 'desc' },
//       take: 10
//     });

//     // Récupérer les stats de sessions pour chaque utilisateur
//     const usersWithStats = await Promise.all(users.map(async (user) => {
//       const sessions = await this.prisma.studySession.findMany({
//         where: { userId: user.id, status: 'completed', deletedAt: null },
//         select: { plannedStart: true, plannedEnd: true, actualStart: true, actualEnd: true }
//       });
      
//       let totalMinutes = 0;
//       for (const session of sessions) {
//         const start = session.actualStart || session.plannedStart;
//         const end = session.actualEnd || session.plannedEnd;
//         if (start && end) {
//           const duration = (end.getTime() - start.getTime()) / (1000 * 60);
//           totalMinutes += duration;
//         }
//       }
      
//       return {
//         id: user.id,
//         firstName: user.firstName,
//         lastName: user.lastName,
//         email: user.email,
//         role: user.role,
//         status: user.status,
//         xpPoints: user.xpPoints,
//         level: user.level,
//         sessions: sessions.length,
//         hours: Math.round(totalMinutes / 60),
//         registeredAt: user.createdAt
//       };
//     }));

//     return usersWithStats;
//   }

//   @Get('activity')
//   async getActivity() {
//     // Récupérer les activités récentes depuis la base
//     const recentSessions = await this.prisma.studySession.findMany({
//       where: { status: 'completed', deletedAt: null },
//       orderBy: { updatedAt: 'desc' },
//       take: 5,
//       include: {
//         user: { select: { firstName: true, lastName: true } }
//       }
//     });

//     const recentUsers = await this.prisma.user.findMany({
//       where: { deletedAt: null },
//       orderBy: { createdAt: 'desc' },
//       take: 3,
//       select: { firstName: true, lastName: true, email: true }
//     });

//     const activities = [
//       ...recentSessions.map(s => ({
//         user: `${s.user.firstName} ${s.user.lastName}`,
//         action: `a complété la session "${s.title}"`,
//         time: `${Math.floor((Date.now() - s.updatedAt.getTime()) / 60000)} min`
//       })),
//       ...recentUsers.map(u => ({
//         user: `${u.firstName} ${u.lastName}`,
//         action: `a rejoint StudyFlow`,
//         time: "récemment"
//       }))
//     ];

//     return activities.slice(0, 5);
//   }

//   // backend/src/admin/admin.controller.ts

// // Ajouter un utilisateur (POST)
// @Post('users')
// async createUser(@Body() createUserDto: any) {
//   // Vérifier si l'email existe déjà
//   const existingUser = await this.prisma.user.findUnique({
//     where: { email: createUserDto.email }
//   });
  
//   if (existingUser) {
//     throw new ConflictException('Cet email est déjà utilisé');
//   }
  
//   // Hasher le mot de passe
//   const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
  
//   // Créer l'utilisateur
//   const user = await this.prisma.user.create({
//     data: {
//       email: createUserDto.email,
//       password_hash: hashedPassword,
//       firstName: createUserDto.firstName,
//       lastName: createUserDto.lastName,
//       role: createUserDto.role || 'user',
//       status: createUserDto.status || 'active',
//       xpPoints: 0,
//       level: 1,
//       streakDays: 0,
//       weeklyGoalHours: 10,
//       timezone: 'Africa/Casablanca',
//       emailVerified: false
//     },
//     select: {
//       id: true,
//       email: true,
//       firstName: true,
//       lastName: true,
//       role: true,
//       status: true,
//       createdAt: true
//     }
//   });
  
//   return user;
// }

// // Modifier un utilisateur (PUT)
// @Put('users/:id')
// async updateUser(@Param('id') id: string, @Body() updateUserDto: any) {
//   // Ne pas permettre la modification du mot de passe ici (faire un endpoint séparé)
//   const { password, ...data } = updateUserDto;
  
//   const user = await this.prisma.user.update({
//     where: { id },
//     data: {
//       firstName: data.firstName,
//       lastName: data.lastName,
//       role: data.role,
//       status: data.status
//     },
//     select: {
//       id: true,
//       email: true,
//       firstName: true,
//       lastName: true,
//       role: true,
//       status: true,
//       createdAt: true
//     }
//   });
  
//   return user;
// }

// // Supprimer un utilisateur (DELETE) - soft delete
// @Delete('users/:id')
// async deleteUser(@Param('id') id: string) {
//   // Soft delete - on ne supprime pas vraiment, on marque deletedAt
//   const user = await this.prisma.user.update({
//     where: { id },
//     data: { deletedAt: new Date() }
//   });
  
//   return { message: 'Utilisateur supprimé avec succès', id: user.id };
// }


// // Après la suppression d'un utilisateur
// // await this.prisma.systemLog.create({
// //   data: {
// //     type: 'user_action',
// //     severity: 'warning',
// //     message: `Utilisateur ${userId} supprimé par l'administrateur`,
// //     userId: adminId,
// //     ip: req.ip
// //   }
// // });
// // Récupérer toutes les sessions
//   @Get('sessions')
//   async getAllSessions(@Query('status') status?: string, @Query('priority') priority?: string) {
//     const where: any = { deletedAt: null };
    
//     if (status && status !== 'tous') {
//       where.status = status;
//     }
    
//     if (priority && priority !== 'tous') {
//       where.priority = priority;
//     }
    
//     const sessions = await this.prisma.studySession.findMany({
//       where,
//       include: {
//         user: {
//           select: {
//             firstName: true,
//             lastName: true,
//             email: true
//           }
//         },
//         subject: {
//           select: {
//             name: true,
//             color: true
//           }
//         }
//       },
//       orderBy: { plannedStart: 'desc' }
//     });
//     console.log('📊 Nombre de sessions en base:', sessions.length); // ← Ajoute ce log
//     return sessions.map(session => ({
//       id: session.id,
//       title: session.title,
//       subject: session.subject?.name || 'Sans matière',
//       subjectColor: session.subject?.color || '#4f8ef7',
//       user: `${session.user.firstName} ${session.user.lastName}`,
//       userEmail: session.user.email,
//       plannedStart: session.plannedStart,
//       plannedEnd: session.plannedEnd,
//       duration: Math.round((session.plannedEnd.getTime() - session.plannedStart.getTime()) / (1000 * 60)),
//       priority: session.priority,
//       status: session.status,
//       createdAt: session.createdAt
//     }));
//   }

//   // Récupérer une session spécifique
//   @Get('sessions/:id')
//   async getSessionById(@Param('id') id: string) {
//     const session = await this.prisma.studySession.findUnique({
//       where: { id, deletedAt: null },
//       include: {
//         user: {
//           select: {
//             firstName: true,
//             lastName: true,
//             email: true
//           }
//         },
//         subject: {
//           select: {
//             name: true,
//             color: true
//           }
//         }
//       }
//     });

//     if (!session) {
//       throw new Error('Session non trouvée');
//     }

//     return {
//       id: session.id,
//       title: session.title,
//       description: session.description,
//       subject: session.subject?.name || 'Sans matière',
//       subjectColor: session.subject?.color || '#4f8ef7',
//       user: `${session.user.firstName} ${session.user.lastName}`,
//       userEmail: session.user.email,
//       plannedStart: session.plannedStart,
//       plannedEnd: session.plannedEnd,
//       actualStart: session.actualStart,
//       actualEnd: session.actualEnd,
//       duration: Math.round((session.plannedEnd.getTime() - session.plannedStart.getTime()) / (1000 * 60)),
//       priority: session.priority,
//       status: session.status,
//       notes: session.notes,
//       createdAt: session.createdAt
//     };
//   }

//   // Modifier le statut d'une session
//   @Put('sessions/:id/status')
//   async updateSessionStatus(@Param('id') id: string, @Body() body: { status: string }) {
//     const session = await this.prisma.studySession.update({
//       where: { id },
//       data: { 
//         status: body.status as any,
//         updatedAt: new Date()
//       }
//     });
//     return session;
//   }

//   // Modifier la priorité d'une session
//   @Put('sessions/:id/priority')
//   async updateSessionPriority(@Param('id') id: string, @Body() body: { priority: string }) {
//     const session = await this.prisma.studySession.update({
//       where: { id },
//       data: { 
//         priority: body.priority as any,
//         updatedAt: new Date()
//       }
//     });
//     return session;
//   }

//   // Modifier une session (admin)
//   @Put('sessions/:id')
//   async updateSession(@Param('id') id: string, @Body() updateData: any) {
//     const session = await this.prisma.studySession.update({
//       where: { id },
//       data: {
//         title: updateData.title,
//         description: updateData.description,
//         priority: updateData.priority as any,
//         status: updateData.status as any,
//         plannedStart: updateData.plannedStart ? new Date(updateData.plannedStart) : undefined,
//         plannedEnd: updateData.plannedEnd ? new Date(updateData.plannedEnd) : undefined,
//         updatedAt: new Date()
//       }
//     });
//     return session;
//   }

//   // Supprimer une session (soft delete)
//   @Delete('sessions/:id')
//   async deleteSession(@Param('id') id: string) {
//     const session = await this.prisma.studySession.update({
//       where: { id },
//       data: { deletedAt: new Date() }
//     });
//     return { message: 'Session supprimée avec succès', id: session.id };
//   }

//   // Statistiques des sessions
//   @Get('sessions-stats')
//   async getSessionsStats() {
//     const total = await this.prisma.studySession.count({ where: { deletedAt: null } });
//     const completed = await this.prisma.studySession.count({ where: { status: 'completed', deletedAt: null } });
//     const inProgress = await this.prisma.studySession.count({ where: { status: 'in_progress', deletedAt: null } });
//     const planned = await this.prisma.studySession.count({ where: { status: 'planned', deletedAt: null } });
//     const cancelled = await this.prisma.studySession.count({ where: { status: 'cancelled', deletedAt: null } });
//     const missed = await this.prisma.studySession.count({ where: { status: 'missed', deletedAt: null } });

//     // Sessions par matière
//     const bySubject = await this.prisma.studySession.groupBy({
//       by: ['subjectId'],
//       where: { deletedAt: null },
//       _count: { subjectId: true }
//     });

//     return {
//       total,
//       completed,
//       inProgress,
//       planned,
//       cancelled,
//       missed,
//       bySubject
//     };
//   }


// // Récupérer tous les groupes
// @Get('groups')
// async getAllGroups() {
//   const groups = await this.prisma.studyGroup.findMany({
//     where: { isActive: true },
//     include: {
//       creator: {
//         select: {
//           firstName: true,
//           lastName: true,
//           email: true
//         }
//       },
//       members: {
//         where: { isActive: true },
//         select: {
//           userId: true,
//           role: true
//         }
//       }
//     },
//     orderBy: { createdAt: 'desc' }
//   });

//   return groups.map(group => ({
//     id: group.id,
//     name: group.name,
//     description: group.description,
//     owner: `${group.creator.firstName} ${group.creator.lastName}`,
//     ownerEmail: group.creator.email,
//     memberCount: group.members.length,
//     maxMembers: group.maxMembers,
//     isPublic: group.isPublic,
//     createdAt: group.createdAt,
//     subject: null // À remplacer par la matière si liée
//   }));
// }

// // Récupérer un groupe spécifique
// @Get('groups/:id')
// async getGroupById(@Param('id') id: string) {
//   const group = await this.prisma.studyGroup.findUnique({
//     where: { id, isActive: true },
//     include: {
//       creator: {
//         select: {
//           id: true,           // ← AJOUTE id
//           firstName: true,
//           lastName: true,
//           email: true
//         }
//       },
//       members: {
//         where: { isActive: true },
//         include: {
//           user: {
//             select: {
//               id: true,       // ← AJOUTE id
//               firstName: true,
//               lastName: true,
//               email: true
//             }
//           }
//         }
//       }
//     }
//   });

//   if (!group) {
//     throw new Error('Groupe non trouvé');
//   }

//   return {
//     id: group.id,
//     name: group.name,
//     description: group.description,
//     owner: `${group.creator.firstName} ${group.creator.lastName}`,
//     ownerEmail: group.creator.email,
//     memberCount: group.members.length,
//     maxMembers: group.maxMembers,
//     isPublic: group.isPublic,
//     invitationCode: group.invitationCode,
//     createdAt: group.createdAt,
//     members: group.members.map(m => ({
//       id: m.user.id,
//       name: `${m.user.firstName} ${m.user.lastName}`,
//       email: m.user.email,
//       role: m.role
//     }))
//   };
// }

// // Créer un groupe (admin)
// @Post('groups')
// async createGroup(@Body() body: any) {
//   const group = await this.prisma.studyGroup.create({
//     data: {
//       name: body.name,
//       description: body.description,
//       createdBy: body.createdBy,
//       isPublic: body.isPublic ?? true,
//       maxMembers: body.maxMembers ?? 20,
//       isActive: true
//     }
//   });

//   // Ajouter le créateur comme membre owner
//   await this.prisma.groupMember.create({
//     data: {
//       groupId: group.id,
//       userId: body.createdBy,
//       role: 'owner',
//       isActive: true
//     }
//   });

//   return group;
// }

// // Modifier un groupe
// @Put('groups/:id')
// async updateGroup(@Param('id') id: string, @Body() body: any) {
//   const group = await this.prisma.studyGroup.update({
//     where: { id },
//     data: {
//       name: body.name,
//       description: body.description,
//       isPublic: body.isPublic,
//       maxMembers: body.maxMembers,
//       updatedAt: new Date()
//     }
//   });
//   return group;
// }

// // Supprimer un groupe (soft delete)
// @Delete('groups/:id')
// async deleteGroup(@Param('id') id: string) {
//   const group = await this.prisma.studyGroup.update({
//     where: { id },
//     data: { isActive: false }
//   });
//   return { message: 'Groupe supprimé avec succès', id: group.id };
// }

// // Statistiques des groupes
// @Get('groups-stats')
// async getGroupsStats() {
//   const total = await this.prisma.studyGroup.count({ where: { isActive: true } });
//   const publicGroups = await this.prisma.studyGroup.count({ where: { isActive: true, isPublic: true } });
//   const privateGroups = await this.prisma.studyGroup.count({ where: { isActive: true, isPublic: false } });
  
//   const members = await this.prisma.groupMember.findMany({
//     where: { isActive: true },
//     select: { userId: true }
//   });
//   const totalMembers = members.length;

//   return {
//     total,
//     public: publicGroups,
//     private: privateGroups,
//     totalMembers
//   };
// }

// // Récupérer les membres d'un groupe
// @Get('groups/:id/members')
// async getGroupMembers(@Param('id') id: string) {
//   const members = await this.prisma.groupMember.findMany({
//     where: { groupId: id, isActive: true },
//     include: {
//       user: {
//         select: {
//           id: true,           // ← AJOUTE id ici
//           firstName: true,
//           lastName: true,
//           email: true,
//           xpPoints: true,
//           level: true
//         }
//       }
//     }
//   });

//   return members.map(m => ({
//     id: m.user.id,
//     firstName: m.user.firstName,
//     lastName: m.user.lastName,
//     email: m.user.email,
//     role: m.role,
//     xpPoints: m.user.xpPoints,
//     level: m.user.level
//   }));
// }

// // Ajouter un membre à un groupe
// @Post('groups/:id/members')
// async addMember(@Param('id') id: string, @Body() body: { userId: string; role?: string }) {
//   const member = await this.prisma.groupMember.create({
//     data: {
//       groupId: id,
//       userId: body.userId,
//       role: (body.role as any) ?? 'member',
//       isActive: true
//     }
//   });
//   return member;
// }

// // Retirer un membre d'un groupe
// @Delete('groups/:groupId/members/:userId')
// async removeMember(@Param('groupId') groupId: string, @Param('userId') userId: string) {
//   const member = await this.prisma.groupMember.update({
//     where: { groupId_userId: { groupId, userId } },
//     data: { isActive: false }
//   });
//   return { message: 'Membre retiré avec succès' };
// }

// // backend/src/admin/admin.controller.ts
// // Ajoute ces méthodes après les méthodes des groupes

// // ============================================
// // PRODUCTIVITÉ - NOUVEAUX ENDPOINTS
// // ============================================

// // backend/src/admin/admin.controller.ts
// // Ajoute ces méthodes après les méthodes des groupes

// // ============================================
// // PRODUCTIVITÉ - NOUVEAUX ENDPOINTS (CORRIGÉ)
// // ============================================

// // Statistiques globales de productivité
// @Get('productivity')
// async getProductivityStats() {
//   // 1. Statistiques globales
//   const totalUsers = await this.prisma.user.count({ where: { deletedAt: null, status: 'active' } });
  
//   const allSessions = await this.prisma.studySession.findMany({
//     where: { deletedAt: null },
//     select: { status: true, plannedStart: true, plannedEnd: true, actualStart: true, actualEnd: true }
//   });
  
//   const totalSessions = allSessions.length;
//   const completedSessions = allSessions.filter(s => s.status === 'completed').length;
//   const avgCompletionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  
//   // Calcul des heures totales à partir des dates
//   let totalMinutes = 0;
//   for (const session of allSessions) {
//     const start = session.actualStart || session.plannedStart;
//     const end = session.actualEnd || session.plannedEnd;
//     if (start && end) {
//       const duration = (end.getTime() - start.getTime()) / (1000 * 60);
//       totalMinutes += duration;
//     }
//   }
//   const totalHours = Math.round(totalMinutes / 60);
  
//   // Streak moyen
//   const users = await this.prisma.user.findMany({
//     where: { deletedAt: null, status: 'active' },
//     select: { streakDays: true }
//   });
//   const avgStreak = users.length > 0 ? Math.round(users.reduce((acc, u) => acc + u.streakDays, 0) / users.length) : 0;
  
//   const globalStats = {
//     avgCompletionRate,
//     totalHours,
//     totalSessions,
//     activeUsers: totalUsers,
//     avgStreak
//   };
  
//   // 2. Top utilisateurs (les plus actifs)
//   const usersWithStats = await this.prisma.user.findMany({
//     where: { deletedAt: null, status: 'active' },
//     select: {
//       id: true,
//       firstName: true,
//       lastName: true,
//       xpPoints: true,
//       streakDays: true
//     },
//     take: 10
//   });
  
//   const topUsers = await Promise.all(usersWithStats.map(async (user) => {
//     const sessions = await this.prisma.studySession.findMany({
//       where: { userId: user.id, deletedAt: null },
//       select: { status: true, plannedStart: true, plannedEnd: true, actualStart: true, actualEnd: true }
//     });
    
//     let totalMinutes = 0;
//     let completedCount = 0;
//     for (const session of sessions) {
//       const start = session.actualStart || session.plannedStart;
//       const end = session.actualEnd || session.plannedEnd;
//       if (start && end) {
//         const duration = (end.getTime() - start.getTime()) / (1000 * 60);
//         totalMinutes += duration;
//       }
//       if (session.status === 'completed') completedCount++;
//     }
    
//     const completionRate = sessions.length > 0 ? Math.round((completedCount / sessions.length) * 100) : 0;
    
//     return {
//       name: `${user.firstName} ${user.lastName}`,
//       hours: Math.round(totalMinutes / 60),
//       sessions: sessions.length,
//       completionRate,
//       xp: user.xpPoints,
//       streak: user.streakDays
//     };
//   }));
  
//   const sortedTopUsers = topUsers.sort((a, b) => b.hours - a.hours).slice(0, 5);
  
//   // 3. Productivité par matière
//   const subjects = await this.prisma.subject.findMany({
//     where: { isActive: true },
//     select: {
//       id: true,
//       name: true,
//       color: true
//     }
//   });
  
//   const subjectProductivity = await Promise.all(subjects.map(async (subject) => {
//     const sessions = await this.prisma.studySession.findMany({
//       where: { subjectId: subject.id, deletedAt: null },
//       select: { status: true, plannedStart: true, plannedEnd: true, actualStart: true, actualEnd: true }
//     });
    
//     let totalMinutes = 0;
//     let completedCount = 0;
//     for (const session of sessions) {
//       const start = session.actualStart || session.plannedStart;
//       const end = session.actualEnd || session.plannedEnd;
//       if (start && end) {
//         const duration = (end.getTime() - start.getTime()) / (1000 * 60);
//         totalMinutes += duration;
//       }
//       if (session.status === 'completed') completedCount++;
//     }
    
//     const completionRate = sessions.length > 0 ? Math.round((completedCount / sessions.length) * 100) : 0;
    
//     return {
//       name: subject.name,
//       color: subject.color,
//       hours: Math.round(totalMinutes / 60),
//       sessions: sessions.length,
//       completionRate
//     };
//   }));
  
//   const sortedSubjects = subjectProductivity.sort((a, b) => b.hours - a.hours);
  
//   // 4. Activité hebdomadaire
//   const weeklyActivity = await this.getWeeklyActivity();
  
//   return {
//     globalStats,
//     topUsers: sortedTopUsers,
//     subjectProductivity: sortedSubjects,
//     weeklyActivity
//   };
// }

// // Helper pour l'activité hebdomadaire
// private async getWeeklyActivity() {
//   const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
//   const result: any[] = [];
  
//   const now = new Date();
//   const startOfWeek = new Date(now);
//   const dayOfWeek = now.getDay();
//   const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
//   startOfWeek.setDate(now.getDate() - diffToMonday);
//   startOfWeek.setHours(0, 0, 0, 0);
  
//   for (let i = 0; i < 7; i++) {
//     const currentDay = new Date(startOfWeek);
//     currentDay.setDate(startOfWeek.getDate() + i);
//     const nextDay = new Date(currentDay);
//     nextDay.setDate(currentDay.getDate() + 1);
    
//     const sessions = await this.prisma.studySession.count({
//       where: {
//         deletedAt: null,
//         plannedStart: {
//           gte: currentDay,
//           lt: nextDay
//         }
//       }
//     });
    
//     result.push({
//       day: days[i],
//       sessions,
//       hours: sessions * 1.5
//     });
//   }
  
//   return result;
// }

// // Productivité par utilisateur spécifique
// @Get('productivity/user/:userId')
// async getUserProductivity(@Param('userId') userId: string) {
//   const user = await this.prisma.user.findUnique({
//     where: { id: userId, deletedAt: null },
//     select: {
//       id: true,
//       firstName: true,
//       lastName: true,
//       email: true,
//       xpPoints: true,
//       level: true,
//       streakDays: true
//     }
//   });
  
//   if (!user) {
//     throw new Error('Utilisateur non trouvé');
//   }
  
//   const sessions = await this.prisma.studySession.findMany({
//     where: { userId, deletedAt: null },
//     select: {
//       id: true,
//       title: true,
//       status: true,
//       priority: true,
//       plannedStart: true,
//       plannedEnd: true,
//       actualStart: true,
//       actualEnd: true,
//       subject: { select: { name: true, color: true } }
//     },
//     orderBy: { plannedStart: 'desc' }
//   });
  
//   let totalMinutes = 0;
//   let completedCount = 0;
//   for (const session of sessions) {
//     const start = session.actualStart || session.plannedStart;
//     const end = session.actualEnd || session.plannedEnd;
//     if (start && end) {
//       const duration = (end.getTime() - start.getTime()) / (1000 * 60);
//       totalMinutes += duration;
//     }
//     if (session.status === 'completed') completedCount++;
//   }
  
//   const totalHours = Math.round(totalMinutes / 60);
//   const completionRate = sessions.length > 0 ? Math.round((completedCount / sessions.length) * 100) : 0;
  
//   // Sessions par jour (pour graphique)
//   const sessionsByDay = await this.getUserSessionsByDay(userId);
  
//   // Formater les sessions récentes
//   const recentSessions = sessions.slice(0, 10).map(s => ({
//     id: s.id,
//     title: s.title,
//     status: s.status,
//     priority: s.priority,
//     date: s.plannedStart,
//     subject: s.subject?.name || 'Sans matière'
//   }));
  
//   return {
//     user: {
//       id: user.id,
//       name: `${user.firstName} ${user.lastName}`,
//       email: user.email,
//       xpPoints: user.xpPoints,
//       level: user.level,
//       streakDays: user.streakDays
//     },
//     stats: {
//       totalHours,
//       totalSessions: sessions.length,
//       completedSessions: completedCount,
//       completionRate
//     },
//     sessionsByDay,
//     recentSessions
//   };
// }

// private async getUserSessionsByDay(userId: string) {
//   const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
//   const result: any[] = [];
  
//   const now = new Date();
//   const startOfWeek = new Date(now);
//   const dayOfWeek = now.getDay();
//   const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
//   startOfWeek.setDate(now.getDate() - diffToMonday);
//   startOfWeek.setHours(0, 0, 0, 0);
  
//   for (let i = 0; i < 7; i++) {
//     const currentDay = new Date(startOfWeek);
//     currentDay.setDate(startOfWeek.getDate() + i);
//     const nextDay = new Date(currentDay);
//     nextDay.setDate(currentDay.getDate() + 1);
    
//     const sessions = await this.prisma.studySession.count({
//       where: {
//         userId,
//         deletedAt: null,
//         plannedStart: {
//           gte: currentDay,
//           lt: nextDay
//         }
//       }
//     });
    
//     result.push({
//       day: days[i],
//       sessions,
//       hours: sessions * 1.5
//     });
//   }
  
//   return result;
// }
// // backend/src/admin/admin.controller.ts

// // ============================================
// // NOTIFICATIONS - ENDPOINTS COMPLETS
// // ============================================

// // Récupérer toutes les notifications
// @Get('notifications')
// async getAllNotifications() {
//   const notifications = await this.prisma.notification.findMany({
//     orderBy: { createdAt: 'desc' },
//     include: {
//       user: {
//         select: {
//           firstName: true,
//           lastName: true,
//           email: true
//         }
//       }
//     }
//   });

//   return notifications.map(n => ({
//     id: n.id,
//     type: n.type,
//     title: n.title,
//     body: n.body,
//     isRead: n.isRead,
//     createdAt: n.createdAt,
//     userId: n.userId,
//     userName: n.user ? `${n.user.firstName} ${n.user.lastName}` : null,
//     data: n.data
//   }));
// }

// // Récupérer le compteur des notifications non lues
// @Get('notifications/unread-count')
// async getUnreadCount() {
//   const count = await this.prisma.notification.count({
//     where: { isRead: false }
//   });
//   return { count };
// }

// // Marquer une notification comme lue
// @Put('notifications/:id/read')
// async markAsRead(@Param('id') id: string) {
//   const notification = await this.prisma.notification.update({
//     where: { id },
//     data: { isRead: true }
//   });
//   return notification;
// }

// // Marquer toutes les notifications comme lues
// @Put('notifications/mark-all-read')
// async markAllAsRead() {
//   await this.prisma.notification.updateMany({
//     where: { isRead: false },
//     data: { isRead: true }
//   });
//   return { message: 'Toutes les notifications ont été marquées comme lues' };
// }

// // Supprimer une notification
// @Delete('notifications/:id')
// async deleteNotification(@Param('id') id: string) {
//   await this.prisma.notification.delete({ where: { id } });
//   return { message: 'Notification supprimée' };
// }

// // Supprimer plusieurs notifications
// @Delete('notifications')
// async deleteMultipleNotifications(@Body() body: { ids: string[] }) {
//   await this.prisma.notification.deleteMany({
//     where: { id: { in: body.ids } }
//   });
//   return { message: `${body.ids.length} notifications supprimées` };
// }

// // ============================================
// // CRÉATION AUTOMATIQUE DE NOTIFICATIONS
// // ============================================

// // Créer une notification pour un nouvel utilisateur
// async notifyNewUser(userId: string, userName: string) {
//   await this.prisma.notification.create({
//     data: {
//       type: 'member_joined',
//       title: 'Nouvel utilisateur inscrit',
//       body: `${userName} a rejoint la plateforme`,
//       userId: userId,
//       data: { event: 'user_registered' }
//     }
//   });
// }

// // Créer une notification pour une session annulée
// async notifySessionCancelled(userId: string, sessionTitle: string) {
//   await this.prisma.notification.create({
//     data: {
//       type: 'session_cancelled',
//       title: 'Session annulée',
//       body: `La session "${sessionTitle}" a été annulée`,
//       userId: userId,
//       data: { event: 'session_cancelled' }
//     }
//   });
// }

// // Créer une notification pour un objectif atteint
// async notifyGoalAchieved(userId: string, subjectName: string, hours: number) {
//   await this.prisma.notification.create({
//     data: {
//       type: 'goal_achieved',
//       title: 'Objectif atteint !',
//       body: `Félicitations ! Vous avez atteint votre objectif de ${hours}h en ${subjectName}`,
//       userId: userId,
//       data: { subject: subjectName, hours: hours }
//     }
//   });
// }

// // Créer une notification pour une invitation
// async notifyGroupInvitation(userId: string, groupName: string, inviterName: string) {
//   await this.prisma.notification.create({
//     data: {
//       type: 'group_invitation',
//       title: 'Invitation à un groupe',
//       body: `${inviterName} vous invite à rejoindre le groupe "${groupName}"`,
//       userId: userId,
//       data: { groupName: groupName, inviter: inviterName }
//     }
//   });
// }
// // backend/src/admin/admin.controller.ts

// // ============================================
// // SYSTÈME LOGS - ENDPOINTS
// // ============================================

// // Récupérer tous les logs système
// @Get('system-logs')
// async getSystemLogs(@Query('type') type?: string, @Query('severity') severity?: string) {
//   const where: any = {};
  
//   if (type && type !== 'tous') {
//     where.type = type;
//   }
  
//   if (severity && severity !== 'tous') {
//     where.severity = severity;
//   }
  
//   const logs = await this.prisma.systemLog.findMany({
//     where,
//     orderBy: { createdAt: 'desc' },
//     take: 500
//   });
  
//   return logs;
// }

// // Créer un log système
// async createSystemLog(type: string, severity: string, message: string, userId?: string, ip?: string) {
//   await this.prisma.systemLog.create({
//     data: {
//       type,
//       severity,
//       message,
//       userId,
//       ip,
//       createdAt: new Date()
//     }
//   });
// }
// }