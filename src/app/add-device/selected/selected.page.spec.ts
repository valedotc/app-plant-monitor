import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectedPage } from './selected.page';

describe('SelectedPage', () => {
  let component: SelectedPage;
  let fixture: ComponentFixture<SelectedPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SelectedPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
