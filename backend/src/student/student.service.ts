// backend/src/student/student.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudentService {
  constructor(private prisma: PrismaService) {}

  // Récupérer les stats de l'étudiant
  async getStats(userId: string) {
    // Récupérer les sessions complétées
    const sessions = await this.prisma.studySession.findMany({
      where: { userId, status: 'completed', deletedAt: null },
      select: { plannedStart: true, plannedEnd: true, actualStart: true, actualEnd: true }
    });

    // Calculer les minutes totales d'étude
    let totalMinutes = 0;
    for (const session of sessions) {
      const start = session.actualStart || session.plannedStart;
      const end = session.actualEnd || session.plannedEnd;
      if (start && end) {
        const duration = (end.getTime() - start.getTime()) / (1000 * 60);
        totalMinutes += duration;
      }
    }

    const totalHours = Math.round(totalMinutes / 60);
    const completedCount = sessions.length;
    
    const plannedSessions = await this.prisma.studySession.count({
      where: { userId, status: 'planned', deletedAt: null }
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { xpPoints: true, level: true, streakDays: true }
    });

    return {
      totalStudyHours: totalHours,
      completedSessions: completedCount,
      plannedSessions: plannedSessions + completedCount,
      streakDays: user?.streakDays || 0,
      xpPoints: user?.xpPoints || 0,
      level: user?.level || 1,
      nextLevelXp: (user?.level || 1) * 200
    };
  }

  // Récupérer les matières de l'étudiant
  async getSubjects(userId: string) {
    return this.prisma.subject.findMany({
      where: { userId, isActive: true },
      orderBy: { priority: 'desc' }
    });
  }

  // Ajouter une matière
  async addSubject(userId: string, data: { name: string; color: string; priority: string }) {
    return this.prisma.subject.create({
      data: {
        userId,
        name: data.name,
        color: data.color,
        priority: data.priority as any,
        isActive: true
      }
    });
  }

  // Supprimer une matière (soft delete)
  async deleteSubject(userId: string, subjectId: string) {
    return this.prisma.subject.update({
      where: { id: subjectId, userId },
      data: { isActive: false }
    });
  }

  // Récupérer les sessions d'étude
  async getSessions(userId: string) {
    const sessions = await this.prisma.studySession.findMany({
      where: { userId, deletedAt: null },
      include: { subject: { select: { name: true, color: true } } },
      orderBy: { plannedStart: 'asc' }
    });

    return sessions.map(session => ({
      id: session.id,
      title: session.title,
      subject: session.subject?.name || 'Sans matière',
      subjectColor: session.subject?.color || '#4f8ef7',
      plannedStart: session.plannedStart,
      plannedEnd: session.plannedEnd,
      duration: Math.round((session.plannedEnd.getTime() - session.plannedStart.getTime()) / (1000 * 60)),
      priority: session.priority,
      status: session.status
    }));
  }

  // Compléter une session
  async completeSession(userId: string, sessionId: string) {
    const session = await this.prisma.studySession.update({
      where: { id: sessionId, userId },
      data: {
        status: 'completed',
        actualEnd: new Date()
      }
    });

    // Mettre à jour les XP
    await this.prisma.user.update({
      where: { id: userId },
      data: { xpPoints: { increment: 50 } }
    });

    // Mettre à jour le streak
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastActiveDate: new Date() }
    });

    return session;
  }

  // Récupérer les groupes d'étude
  async getGroups(userId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId, isActive: true },
      include: {
        group: {
          include: {
            members: { where: { isActive: true } },
            creator: { select: { firstName: true, lastName: true } }
          }
        }
      }
    });

    return memberships.map(m => ({
      id: m.group.id,
      name: m.group.name,
      description: m.group.description,
      memberCount: m.group.members.length,
      maxMembers: m.group.maxMembers,
      creatorName: `${m.group.creator.firstName} ${m.group.creator.lastName}`,
      role: m.role
    }));
  }

  // Créer un groupe
  async createGroup(userId: string, data: { name: string; description: string; isPublic: boolean; maxMembers: number }) {
    const group = await this.prisma.studyGroup.create({
      data: {
        createdBy: userId,
        name: data.name,
        description: data.description,
        isPublic: data.isPublic,
        maxMembers: data.maxMembers || 20,
        isActive: true
      }
    });

    // Ajouter le créateur comme membre
    await this.prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: 'owner',
        isActive: true
      }
    });

    return group;
  }

  // Récupérer les notifications
  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }

  // Marquer notification comme lue
  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId, userId },
      data: { isRead: true }
    });
  }

  // Générer planning intelligent
  async generateSchedule(userId: string, data: any) {
    const subjects = data.subjects || [];
    const availabilities = data.availabilities || [];
    const weeklyGoals = data.weeklyGoals || [];

    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const timeSlots = ['09:00', '11:00', '14:00', '16:00', '19:00'];
    
    const schedule: any[] = [];

    // Trier les matières par priorité
    const sortedSubjects = [...subjects].sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });

    for (const subject of sortedSubjects) {
      const goal = weeklyGoals.find(g => g.subjectId === subject.id);
      const targetHours = goal?.targetHours || 3;
      const sessionsNeeded = Math.ceil(targetHours / 1.5); // sessions de 1h30

      for (let i = 0; i < Math.min(sessionsNeeded, 5); i++) {
        const day = days[Math.floor(Math.random() * days.length)];
        const time = timeSlots[Math.floor(Math.random() * timeSlots.length)];
        
        schedule.push({
          subject: subject.name,
          subjectId: subject.id,
          day: day,
          time: time,
          duration: 90,
          priority: subject.priority
        });
      }
    }

    return schedule.slice(0, 15); // Maximum 15 sessions
  }
}