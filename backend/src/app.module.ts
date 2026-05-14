// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { StudentModule } from './student/student.module';
import { NotificationModule } from './notification/notification.module';  // ← AJOUTE
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    AdminModule,
    StudentModule,
    NotificationModule,  // ← AJOUTE
  ],
  providers: [PrismaService],
})
export class AppModule {}