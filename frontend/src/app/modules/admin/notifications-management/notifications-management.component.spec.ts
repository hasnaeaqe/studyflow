import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationsManagementComponent } from './notifications-management.component';

describe('NotificationsManagementComponent', () => {
  let component: NotificationsManagementComponent;
  let fixture: ComponentFixture<NotificationsManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsManagementComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NotificationsManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
