import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupsManagementComponent } from './groups-management.component';

describe('GroupsManagementComponent', () => {
  let component: GroupsManagementComponent;
  let fixture: ComponentFixture<GroupsManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupsManagementComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GroupsManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
