import { ComponentFixture, TestBed } from "@angular/core/testing";
import { LoadingComponent } from "./loading.component";

describe("LoadingComponent", () => {
  let component: LoadingComponent;
  let fixture: ComponentFixture<LoadingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should display spinner by default", () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector("svg")).toBeTruthy();
  });

  it("should display message when provided", () => {
    component.message = "Loading test...";
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain("Loading test...");
  });

  it("should hide spinner when showSpinner is false", () => {
    component.showSpinner = false;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector("svg")).toBeFalsy();
  });

  it("should apply correct size classes", () => {
    component.size = "lg";
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const svg = compiled.querySelector("svg");
    expect(svg?.classList.contains("h-8")).toBeTruthy();
    expect(svg?.classList.contains("w-8")).toBeTruthy();
  });

  it("should apply correct color classes", () => {
    component.color = "green";
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const svg = compiled.querySelector("svg");
    expect(svg?.classList.contains("text-green-600")).toBeTruthy();
  });
});
