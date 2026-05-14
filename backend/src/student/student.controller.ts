// backend/src/student/student.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { StudentService } from './student.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('student')
@UseGuards(JwtAuthGuard)
export class StudentController {
  constructor(private studentService: StudentService) {}

  @Get('stats')
  async getStats(@Request() req) {
    return this.studentService.getStats(req.user.userId);
  }

  @Get('subjects')
  async getSubjects(@Request() req) {
    return this.studentService.getSubjects(req.user.userId);
  }

  @Post('subjects')
  async addSubject(@Request() req, @Body() body: { name: string; color: string; priority: string }) {
    return this.studentService.addSubject(req.user.userId, body);
  }

  @Delete('subjects/:id')
  async deleteSubject(@Request() req, @Param('id') id: string) {
    return this.studentService.deleteSubject(req.user.userId, id);
  }

  @Get('sessions')
  async getSessions(@Request() req) {
    return this.studentService.getSessions(req.user.userId);
  }

  @Put('sessions/:id/complete')
  async completeSession(@Request() req, @Param('id') id: string) {
    return this.studentService.completeSession(req.user.userId, id);
  }
  

  @Get('groups')
  async getGroups(@Request() req) {
    return this.studentService.getGroups(req.user.userId);
  }

  @Post('groups')
  async createGroup(@Request() req, @Body() body: { name: string; description: string; isPublic: boolean; maxMembers: number }) {
    return this.studentService.createGroup(req.user.userId, body);
  }

  @Get('notifications')
  async getNotifications(@Request() req) {
    return this.studentService.getNotifications(req.user.userId);
  }

  @Put('notifications/:id/read')
  async markAsRead(@Request() req, @Param('id') id: string) {
    return this.studentService.markAsRead(req.user.userId, id);
  }

  @Post('generate-schedule')
  async generateSchedule(@Request() req, @Body() body: any) {
    return this.studentService.generateSchedule(req.user.userId, body);
  }
}