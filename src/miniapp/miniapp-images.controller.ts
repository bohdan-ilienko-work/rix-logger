import { Controller, Get, Logger, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PetsService } from '../pets/pets.service';
import { PetEventsService } from '../pet-events/pet-events.service';

@Controller('miniapp')
export class MiniappImagesController {
    private readonly logger = new Logger(MiniappImagesController.name);

    constructor(
        private readonly petsService: PetsService,
        private readonly petEventsService: PetEventsService,
    ) { }

    @Get('pets/:petId/avatar')
    async getAvatar(
        @Param('petId') petId: string,
        @Res() res: Response,
    ) {
        this.logger.debug(`getAvatar pet=${petId}`);
        const result = await this.petsService.getAvatar(petId);
        if (!result) {
            this.logger.debug(`getAvatar: no avatar for pet=${petId}`);
            throw new NotFoundException('No avatar');
        }
        res.set({ 'Content-Type': result.mime, 'Cache-Control': 'public, max-age=3600' });
        res.send(result.data);
    }

    @Get('events/:eventId/images/:imageId')
    async getEventImage(
        @Param('imageId') imageId: string,
        @Res() res: Response,
    ) {
        this.logger.debug(`getEventImage image=${imageId}`);
        const img = await this.petEventsService.findImageById(imageId);
        if (!img) {
            this.logger.debug(`getEventImage: not found image=${imageId}`);
            throw new NotFoundException('Image not found');
        }
        res.set({ 'Content-Type': img.mime, 'Cache-Control': 'public, max-age=3600' });
        res.send(img.data);
    }
}
