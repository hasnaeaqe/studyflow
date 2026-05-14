import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LogsModule } from '../logs/logs.module';  // ← Importer LogsModule

@Module({
  imports: [PrismaModule, LogsModule],
  controllers: [AdminController],
  providers: [PrismaService],
})
export class AdminModule {}