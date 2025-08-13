import { PartialType } from "@nestjs/swagger";
import { CreateVanDto } from "./create-van.dto";

export class UpdateVanDto extends PartialType(CreateVanDto) {}
