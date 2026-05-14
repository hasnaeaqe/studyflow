import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filterByDay',
  standalone: true
})
export class FilterByDayPipe implements PipeTransform {
  transform(sessions: any[], day: string): any[] {
    if (!sessions || !sessions.length || !day) return [];
    
    const dayMap: { [key: string]: number } = {
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6,
      'sunday': 0
    };
    
    const targetDay = dayMap[day.toLowerCase()];
    if (targetDay === undefined) return [];
    
    return sessions.filter(session => {
      const sessionDate = new Date(session.plannedStart);
      return sessionDate.getDay() === targetDay;
    });
  }
}