import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  async notifyNewUser(userId: string, firstName: string, lastName: string) {
    const fullName = `${firstName} ${lastName}`;
    await this.prisma.notification.create({
      data: {
        type: 'member_joined',
        title: 'Nouvel utilisateur',
        body: `${fullName} a rejoint StudyFlow`,
        data: { event: 'user_registered', userId },
        isRead: false,
        user: { connect: { id: userId } }  // ← AJOUTE CETTE LIGNE
      }
    });
  }

  async notifySessionCancelled(userId: string, sessionTitle: string) {
    await this.prisma.notification.create({
      data: {
        type: 'session_cancelled',
        title: 'Session annulée',
        body: `Votre session "${sessionTitle}" a été annulée`,
        data: { event: 'session_cancelled', sessionTitle },
        isRead: false,
        user: { connect: { id: userId } }  // ← AJOUTE CETTE LIGNE
      }
    });
  }

  async notifyGoalAchieved(userId: string, subjectName: string, hours: number) {
    await this.prisma.notification.create({
      data: {
        type: 'goal_achieved',
        title: 'Objectif atteint !',
        body: `Félicitations ! Vous avez atteint ${hours}h d'étude en ${subjectName}`,
        data: { subject: subjectName, hours },
        isRead: false,
        user: { connect: { id: userId } }  // ← AJOUTE CETTE LIGNE
      }
    });
  }

  async notifyGroupSessionCreated(groupId: string, groupName: string, sessionTitle: string) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId, isActive: true },
      select: { userId: true }
    });
    
    for (const member of members) {
      await this.prisma.notification.create({
        data: {
          type: 'group_session_created',
          title: 'Nouvelle session de groupe',
          body: `Le groupe "${groupName}" a créé une session: ${sessionTitle}`,
          data: { groupId, groupName, sessionTitle },
          isRead: false,
          user: { connect: { id: member.userId } }  // ← AJOUTE CETTE LIGNE
        }
      });
    }
  }

  async notifyGroupInvitation(userId: string, groupName: string, inviterName: string) {
    await this.prisma.notification.create({
      data: {
        type: 'group_invitation',
        title: 'Invitation à un groupe',
        body: `${inviterName} vous invite à rejoindre le groupe "${groupName}"`,
        data: { groupName, inviter: inviterName },
        isRead: false,
        user: { connect: { id: userId } }  // ← AJOUTE CETTE LIGNE
      }
    });
  }

  async notifySessionReminder(userId: string, sessionTitle: string, minutesBefore: number) {
    await this.prisma.notification.create({
      data: {
        type: 'session_reminder',
        title: 'Rappel de session',
        body: `Votre session "${sessionTitle}" commence dans ${minutesBefore} minutes`,
        data: { sessionTitle, minutesBefore },
        isRead: false,
        scheduledFor: new Date(Date.now() + minutesBefore * 60000),
        user: { connect: { id: userId } }  // ← AJOUTE CETTE LIGNE
      }
    });
  }
}