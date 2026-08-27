const AppError = require('../utils/app-error');
const repository = require('../repositories/review-report.repository');

const ALLOWED_REASONS = new Set(['INAPPROPRIATE','SPAM','FRAUD','ABUSE','OTHER']);
const ADMIN_ACTIONS = new Set(['DISMISSED','REMOVED','REVIEWED']);

function mapReport(row) {
  return { id:Number(row.id), reviewId:Number(row.review_id), reporterId:Number(row.reporter_id), reason:row.reason,
    description:row.description||'', status:row.status, adminNote:row.admin_note||null, createdAt:row.created_at,
    resolvedAt:row.resolved_at, resolvedBy:row.resolved_by, reviewerUsername:row.buyer_username,
    sellerUsername:row.seller_username, reporterUsername:row.reporter_username, rating:Number(row.rating||0), comment:row.comment||'' };
}

async function createReport(reporterId, data) {
  const reviewId=Number(data.reviewId), reason=String(data.reason||'').trim().toUpperCase(), description=String(data.description||'').trim();
  if(!Number.isInteger(reviewId)||reviewId<=0) throw new AppError('A valid reviewId is required.',400,'INVALID_REVIEW_ID');
  if(!ALLOWED_REASONS.has(reason)) throw new AppError('Invalid report reason.',400,'INVALID_REPORT_REASON');
  if(description.length>500) throw new AppError('Report description must not exceed 500 characters.',400,'DESCRIPTION_TOO_LONG');
  const review=await repository.findReview(reviewId); if(!review) throw new AppError('Review not found.',404,'REVIEW_NOT_FOUND');
  if(Number(review.buyer_id)===Number(reporterId)) throw new AppError('You cannot report your own review.',403,'CANNOT_REPORT_OWN_REVIEW');
  if(await repository.findExisting(reviewId,reporterId)) throw new AppError('You have already reported this review.',409,'REPORT_ALREADY_EXISTS');
  return mapReport(await repository.create({reviewId,reporterId,reason,description}));
}

async function listPendingReports() { return (await repository.listPending()).map(mapReport); }
async function resolveReport(adminId, reportId, action, adminNote='') {
  const id=Number(reportId), status=String(action||'').trim().toUpperCase(), note=String(adminNote||'').trim();
  if(!Number.isInteger(id)||id<=0) throw new AppError('A valid reportId is required.',400,'INVALID_REPORT_ID');
  if(!ADMIN_ACTIONS.has(status)) throw new AppError('Invalid report action.',400,'INVALID_REPORT_ACTION');
  if(note.length>500) throw new AppError('Admin note must not exceed 500 characters.',400,'ADMIN_NOTE_TOO_LONG');
  const existing=await repository.getById(id); if(!existing) throw new AppError('Report not found.',404,'REPORT_NOT_FOUND');
  if(status==='REMOVED') await repository.hideReview(existing.review_id);
  const result=await repository.updateStatus(id,status,adminId,note); if(!result) throw new AppError('Report has already been resolved.',409,'REPORT_ALREADY_RESOLVED');
  return mapReport(result);
}
module.exports={createReport,listPendingReports,resolveReport,ALLOWED_REASONS};
