import api,{unwrap} from '../../services/api';
export const libraryService={
  overview:()=>api.get('/library/overview').then(unwrap),
  books:params=>api.get('/library/books',{params}).then(unwrap),
  book:id=>api.get(`/library/books/${id}`).then(unwrap),
  create:body=>api.post('/library/books',body).then(unwrap),
  update:(id,body)=>api.put(`/library/books/${id}`,body).then(unwrap),
  active:(id,active)=>api.patch(`/library/books/${id}/status`,{active}).then(unwrap),
  copies:(id,quantity)=>api.post(`/library/books/${id}/copies`,{quantity}).then(unwrap),
  copyStatus:(id,status)=>api.patch(`/library/copies/${id}`,{status}).then(unwrap),
  members:search=>api.get('/library/members',{params:{search}}).then(unwrap),
  loans:params=>api.get('/library/loans',{params}).then(unwrap),
  myLoans:params=>api.get('/library/my-loans',{params}).then(unwrap),
  issue:body=>api.post('/library/loans',body).then(unwrap),
  returnBook:(id,body)=>api.post(`/library/loans/${id}/return`,body).then(unwrap),
  renew:(id,dueDate)=>api.post(`/library/loans/${id}/renew`,{dueDate}).then(unwrap),
};
