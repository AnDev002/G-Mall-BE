// Wiki 0044: ReviewController — endpoint user-centric reviews (pending + me).
// FE service `ReviewService.getToReview()` gọi `/reviews/pending`, `getMyReviews()`
// gọi `/reviews/me`. Trước đây BE chỉ có POST /orders/review (submit) — thiếu 2
// GET endpoint này → FE crash khi user vào /user/reviews.
//
// Tách Controller riêng (không gắn vào /orders) vì semantic: review là entity
// độc lập theo user, không gắn cứng với order resource path.
import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { ReviewService } from './review.service';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // GET /reviews/pending — orders đã DELIVERED chưa review
  @Get('pending')
  async pending(@Request() req) {
    return this.reviewService.listPending(req.user.id);
  }

  // GET /reviews/me — reviews user đã submit (product + shop)
  @Get('me')
  async mine(@Request() req) {
    return this.reviewService.listMine(req.user.id);
  }
}
