import { Component, inject, OnInit } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { SecurityService } from "../core/services/security.service";

@Component({
  selector: "app-root",
  imports: [RouterOutlet],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent implements OnInit {
  title = "DSP Hub";

  // 🔒 Angular 20: Inject security service to initialize security measures
  private securityService = inject(SecurityService);

  ngOnInit(): void {
    // 🚀 Security service is automatically initialized via constructor
    // Angular 20 global error listeners are automatically active
    console.log("🚀 Angular 20 DSP Hub Application Started");
    console.log("🔒 Security measures active");
    console.log("⚡ Zoneless change detection enabled");
  }
}
