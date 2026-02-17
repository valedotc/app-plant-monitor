import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddDevicePage } from './add-device.page';

describe('AddDevicePage', () => {
  let component: AddDevicePage;
  let fixture: ComponentFixture<AddDevicePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AddDevicePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
