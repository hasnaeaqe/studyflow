import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async onModuleInit() {
    await this.prisma.$connect();
    console.log('✅ Connecté à PostgreSQL - studyflow');
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  // Getter pour accéder aux modèles
  get user() {
    return this.prisma.user;
  }

  get subject() {
    return this.prisma.subject;
  }

  get studySession() {
    return this.prisma.studySession;
  }

  get availability() {
    return this.prisma.availability;
  }

  get studyGroup() {
    return this.prisma.studyGroup;
  }

  get groupMember() {
    return this.prisma.groupMember;
  }

  get notification() {
    return this.prisma.notification;
  }

  get refreshToken() {
    return this.prisma.refreshToken;
  }
}